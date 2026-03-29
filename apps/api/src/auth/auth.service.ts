import {
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import bcrypt from "bcryptjs";
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual
} from "crypto";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";

type AccessTokenPayload = AuthUser & {
  tokenType: "access";
  iat: number;
  exp: number;
};

type LoginContext = {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
};

type LoginResult = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

type RefreshResult = LoginResult;

type TokenBundle = {
  roles: string[];
  permissions: string[];
};

@Injectable()
export class AuthService {
  private readonly accessTokenSecret: string;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;
  private readonly loginMaxAttempts: number;
  private readonly loginBlockMinutes: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {
    this.accessTokenSecret = this.readAccessTokenSecret();
    this.accessTokenTtlSeconds = this.readDuration("ACCESS_TOKEN_TTL", "15m");
    this.refreshTokenTtlSeconds = this.readDuration("REFRESH_TOKEN_TTL", "30d");
    this.loginMaxAttempts = Number(
      this.configService.get<string>("LOGIN_MAX_ATTEMPTS") ?? "5"
    );
    this.loginBlockMinutes = Number(
      this.configService.get<string>("LOGIN_BLOCK_MINUTES") ?? "15"
    );
  }

  async login(payload: LoginDto, context: LoginContext): Promise<LoginResult> {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        code: payload.tenantCode
      },
      include: {
        settings: true
      }
    });

    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedException("Credenciales invalidas");
    }

    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        username: payload.username,
        isActive: true,
        deletedAt: null
      }
    });

    if (!user) {
      await this.auditService.record({
        tenantId: tenant.id,
        actorType: "SYSTEM",
        eventCategory: "AUTH",
        eventName: "auth.login.failed.user_not_found",
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        payload: {
          username: payload.username
        }
      });
      throw new UnauthorizedException("Credenciales invalidas");
    }

    if (user.blockedUntil && user.blockedUntil.getTime() > Date.now()) {
      await this.auditService.record({
        tenantId: tenant.id,
        actorUserId: user.id,
        eventCategory: "AUTH",
        eventName: "auth.login.blocked",
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId
      });
      throw new UnauthorizedException("Usuario temporalmente bloqueado");
    }

    const isPasswordValid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.markFailedLogin(user.id);
      await this.auditService.record({
        tenantId: tenant.id,
        actorUserId: user.id,
        eventCategory: "AUTH",
        eventName: "auth.login.failed.invalid_password",
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId
      });
      throw new UnauthorizedException("Credenciales invalidas");
    }

    const tokenBundle = await this.resolveAuthorization(user.id, tenant.id);
    const isAdmin = tokenBundle.roles.includes("ADMIN");
    const mfaRequired = Boolean(tenant.settings?.requireMfaAdmin && isAdmin);

    if (mfaRequired) {
      if (!user.mfaEnabled || !user.mfaSecretEnc) {
        await this.auditService.record({
          tenantId: tenant.id,
          actorUserId: user.id,
          eventCategory: "AUTH",
          eventName: "auth.login.failed.mfa_not_configured",
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId
        });
        throw new ForbiddenException(
          "MFA obligatorio para administradores. Configure MFA para continuar."
        );
      }

      if (!payload.mfaCode || payload.mfaCode !== user.mfaSecretEnc) {
        await this.auditService.record({
          tenantId: tenant.id,
          actorUserId: user.id,
          eventCategory: "AUTH",
          eventName: "auth.login.failed.mfa_invalid",
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId
        });
        throw new UnauthorizedException("Codigo MFA invalido");
      }
    }

    await this.prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        failedLoginAttempts: 0,
        blockedUntil: null,
        lastLoginAt: new Date()
      }
    });

    const authUser: AuthUser = {
      id: user.id,
      tenantId: tenant.id,
      tenantCode: tenant.code,
      username: user.username,
      roles: tokenBundle.roles,
      permissions: tokenBundle.permissions,
      mfaVerified: !mfaRequired || Boolean(payload.mfaCode)
    };

    const accessToken = this.encodeAccessToken(authUser);
    const refreshToken = await this.issueRefreshToken(authUser, context);

    await this.auditService.record({
      tenantId: tenant.id,
      actorUserId: user.id,
      eventCategory: "AUTH",
      eventName: "auth.login.success",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId
    });

    return {
      accessToken,
      refreshToken,
      user: authUser
    };
  }

  async refresh(
    refreshToken: string,
    context: LoginContext
  ): Promise<RefreshResult> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash
      },
      include: {
        user: {
          include: {
            tenant: {
              include: {
                settings: true
              }
            }
          }
        }
      }
    });

    if (!storedToken) {
      throw new UnauthorizedException("Refresh token invalido");
    }

    const now = new Date();
    if (storedToken.revokedAt || storedToken.expiresAt.getTime() <= now.getTime()) {
      await this.revokeAllRefreshTokens(storedToken.tenantId, storedToken.userId);
      await this.auditService.record({
        tenantId: storedToken.tenantId,
        actorUserId: storedToken.userId,
        eventCategory: "SECURITY",
        eventName: "auth.refresh.reuse_detected",
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId
      });
      throw new UnauthorizedException("Refresh token revocado o reutilizado");
    }

    if (!storedToken.user.isActive || storedToken.user.deletedAt) {
      throw new UnauthorizedException("Usuario inactivo");
    }

    const tokenBundle = await this.resolveAuthorization(
      storedToken.userId,
      storedToken.tenantId
    );
    const isAdmin = tokenBundle.roles.includes("ADMIN");
    const mfaRequired = Boolean(
      storedToken.user.tenant.settings?.requireMfaAdmin && isAdmin
    );

    if (mfaRequired && (!storedToken.user.mfaEnabled || !storedToken.user.mfaSecretEnc)) {
      throw new ForbiddenException("MFA requerido para administradores");
    }

    const authUser: AuthUser = {
      id: storedToken.user.id,
      tenantId: storedToken.tenantId,
      tenantCode: storedToken.user.tenant.code,
      username: storedToken.user.username,
      roles: tokenBundle.roles,
      permissions: tokenBundle.permissions,
      mfaVerified: !mfaRequired || storedToken.user.mfaEnabled
    };

    const accessToken = this.encodeAccessToken(authUser);
    const nextRefreshTokenRaw = randomBytes(64).toString("hex");
    const nextRefreshTokenId = randomUUID();

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.refreshToken.create({
        data: {
          id: nextRefreshTokenId,
          tenantId: authUser.tenantId,
          userId: authUser.id,
          tokenHash: this.hashRefreshToken(nextRefreshTokenRaw),
          issuedAt: now,
          expiresAt: new Date(now.getTime() + this.refreshTokenTtlSeconds * 1000),
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null
        }
      });

      await tx.refreshToken.update({
        where: {
          id: storedToken.id
        },
        data: {
          revokedAt: now,
          replacedByTokenId: nextRefreshTokenId
        }
      });
    });

    await this.auditService.record({
      tenantId: authUser.tenantId,
      actorUserId: authUser.id,
      eventCategory: "AUTH",
      eventName: "auth.refresh.success",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId
    });

    return {
      accessToken,
      refreshToken: nextRefreshTokenRaw,
      user: authUser
    };
  }

  async logoutAll(user: AuthUser, context: LoginContext): Promise<number> {
    const now = new Date();
    const result = await this.prisma.refreshToken.updateMany({
      where: {
        tenantId: user.tenantId,
        userId: user.id,
        revokedAt: null
      },
      data: {
        revokedAt: now
      }
    });

    await this.auditService.record({
      tenantId: user.tenantId,
      actorUserId: user.id,
      eventCategory: "AUTH",
      eventName: "auth.logout_all.success",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
      payload: {
        revokedCount: result.count
      }
    });

    return result.count;
  }

  decodeAccessToken(token: string): AuthUser | null {
    try {
      const [encodedHeader, encodedPayload, encodedSignature, ...rest] =
        token.split(".");

      if (!encodedHeader || !encodedPayload || !encodedSignature || rest.length > 0) {
        return null;
      }

      const expectedSignature = this.sign(`${encodedHeader}.${encodedPayload}`);
      if (!this.signaturesMatch(expectedSignature, encodedSignature)) {
        return null;
      }

      const decodedHeader = Buffer.from(encodedHeader, "base64url").toString("utf8");
      const parsedHeader = JSON.parse(decodedHeader) as { alg?: string; typ?: string };
      if (parsedHeader.alg !== "HS256" || parsedHeader.typ !== "JWT") {
        return null;
      }

      const decodedPayload = Buffer.from(encodedPayload, "base64url").toString("utf8");
      const parsedPayload = JSON.parse(decodedPayload) as Partial<AccessTokenPayload>;

      if (
        parsedPayload.tokenType !== "access" ||
        typeof parsedPayload.exp !== "number" ||
        parsedPayload.exp <= this.now()
      ) {
        return null;
      }

      if (
        !parsedPayload.id ||
        !parsedPayload.tenantId ||
        !parsedPayload.tenantCode ||
        !parsedPayload.username ||
        !Array.isArray(parsedPayload.roles) ||
        !Array.isArray(parsedPayload.permissions)
      ) {
        return null;
      }

      return {
        id: parsedPayload.id,
        tenantId: parsedPayload.tenantId,
        tenantCode: parsedPayload.tenantCode,
        username: parsedPayload.username,
        roles: parsedPayload.roles,
        permissions: parsedPayload.permissions,
        mfaVerified: Boolean(parsedPayload.mfaVerified)
      };
    } catch {
      return null;
    }
  }

  getRefreshCookieOptions() {
    const secureCookie = this.configService.get<string>("COOKIE_SECURE") === "true";
    const sameSiteRaw = (
      this.configService.get<string>("COOKIE_SAMESITE") ?? "lax"
    ).toLowerCase();
    const sameSite = ["lax", "strict", "none"].includes(sameSiteRaw)
      ? (sameSiteRaw as "lax" | "strict" | "none")
      : "lax";

    return {
      httpOnly: true,
      secure: secureCookie,
      sameSite,
      path: "/api/auth"
    } as const;
  }

  private async resolveAuthorization(
    userId: string,
    tenantId: string
  ): Promise<TokenBundle> {
    const assignments = await this.prisma.userRole.findMany({
      where: {
        tenantId,
        userId,
        isActive: true,
        OR: [{ validTo: null }, { validTo: { gt: new Date() } }]
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });

    const roleSet = new Set<string>();
    for (const assignment of assignments) {
      roleSet.add(assignment.role.code);
    }

    const roles = [...roleSet];
    const permissions = new Set<string>();

    for (const assignment of assignments) {
      for (const rolePermission of assignment.role.rolePermissions) {
        permissions.add(rolePermission.permission.code);
      }
    }

    if (roles.includes("ADMIN")) {
      permissions.add("*");
    }

    return {
      roles,
      permissions: [...permissions]
    };
  }

  private async issueRefreshToken(
    user: AuthUser,
    context: LoginContext
  ): Promise<string> {
    const rawToken = randomBytes(64).toString("hex");
    const now = new Date();

    await this.prisma.refreshToken.create({
      data: {
        id: randomUUID(),
        tenantId: user.tenantId,
        userId: user.id,
        tokenHash: this.hashRefreshToken(rawToken),
        issuedAt: now,
        expiresAt: new Date(now.getTime() + this.refreshTokenTtlSeconds * 1000),
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null
      }
    });

    return rawToken;
  }

  private async markFailedLogin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId
      }
    });

    if (!user) {
      return;
    }

    const failedLoginAttempts = user.failedLoginAttempts + 1;
    const shouldBlock = failedLoginAttempts >= this.loginMaxAttempts;
    const blockedUntil = shouldBlock
      ? new Date(Date.now() + this.loginBlockMinutes * 60 * 1000)
      : null;

    await this.prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        failedLoginAttempts,
        blockedUntil
      }
    });
  }

  private async revokeAllRefreshTokens(
    tenantId: string,
    userId: string
  ): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        tenantId,
        userId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  private hashRefreshToken(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
  }

  private encodeAccessToken(user: AuthUser): string {
    const now = this.now();
    const header = Buffer.from(
      JSON.stringify({
        alg: "HS256",
        typ: "JWT"
      }),
      "utf8"
    ).toString("base64url");

    const payload = Buffer.from(
      JSON.stringify({
        ...user,
        tokenType: "access",
        iat: now,
        exp: now + this.accessTokenTtlSeconds
      } satisfies AccessTokenPayload),
      "utf8"
    ).toString("base64url");

    const signature = this.sign(`${header}.${payload}`);
    return `${header}.${payload}.${signature}`;
  }

  private sign(input: string): string {
    return createHmac("sha256", this.accessTokenSecret)
      .update(input)
      .digest("base64url");
  }

  private signaturesMatch(expected: string, actual: string): boolean {
    const expectedBuffer = Buffer.from(expected, "utf8");
    const actualBuffer = Buffer.from(actual, "utf8");
    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, actualBuffer);
  }

  private now(): number {
    return Math.floor(Date.now() / 1000);
  }

  private readAccessTokenSecret(): string {
    const secret = this.configService.get<string>("ACCESS_TOKEN_SECRET")?.trim() ?? "";
    if (secret.length < 32) {
      throw new Error(
        "ACCESS_TOKEN_SECRET debe existir y tener al menos 32 caracteres"
      );
    }
    return secret;
  }

  private readDuration(envName: string, defaultValue: string): number {
    const configured = this.configService.get<string>(envName) ?? defaultValue;
    const match = /^(\d+)([smhd])$/.exec(configured.trim());
    if (!match) {
      throw new Error(`${envName} invalido. Use formato: 15m, 1h, 30s, 7d`);
    }

    const value = Number(match[1]);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value;
      case "m":
        return value * 60;
      case "h":
        return value * 60 * 60;
      case "d":
        return value * 60 * 60 * 24;
      default:
        throw new Error(`Unidad de ${envName} no soportada`);
    }
  }
}
