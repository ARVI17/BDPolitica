import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async listUsers(actor: AuthUser, query: ListUsersQueryDto) {
    const normalizedSearch = query.search?.trim();
    const normalizedRole = query.roleCode?.trim().toUpperCase();
    const normalizedStatus = query.status ?? "all";
    const now = new Date();

    const statusFilter =
      normalizedStatus === "active"
        ? { isActive: true }
        : normalizedStatus === "inactive"
          ? { isActive: false }
          : {};

    const searchFilter = normalizedSearch
      ? {
          OR: [
            {
              username: {
                contains: normalizedSearch,
                mode: "insensitive" as const
              }
            },
            {
              email: {
                contains: normalizedSearch,
                mode: "insensitive" as const
              }
            }
          ]
        }
      : {};

    const roleFilter = normalizedRole
      ? {
          userRoles: {
            some: {
              isActive: true,
              OR: [{ validTo: null }, { validTo: { gt: now } }],
              role: {
                code: normalizedRole
              }
            }
          }
        }
      : {};

    const users = await this.prisma.user.findMany({
      where: {
        tenantId: actor.tenantId,
        deletedAt: null,
        ...statusFilter,
        ...searchFilter,
        ...roleFilter
      },
      include: {
        userRoles: {
          where: {
            isActive: true,
            OR: [{ validTo: null }, { validTo: { gt: now } }]
          },
          include: {
            role: true
          }
        }
      },
      orderBy: [{ isActive: "desc" }, { username: "asc" }]
    });

    const output: Array<{
      id: string;
      username: string;
      email: string;
      isActive: boolean;
      mfaEnabled: boolean;
      failedLoginAttempts: number;
      blockedUntil: Date | null;
      lastLoginAt: Date | null;
      createdAt: Date;
      roles: string[];
    }> = [];

    for (const userRecord of users) {
      const roleCodes: string[] = [];
      for (const assignment of userRecord.userRoles) {
        roleCodes.push(assignment.role.code);
      }

      output.push({
        id: userRecord.id,
        username: userRecord.username,
        email: userRecord.email,
        isActive: userRecord.isActive,
        mfaEnabled: userRecord.mfaEnabled,
        failedLoginAttempts: userRecord.failedLoginAttempts,
        blockedUntil: userRecord.blockedUntil,
        lastLoginAt: userRecord.lastLoginAt,
        createdAt: userRecord.createdAt,
        roles: roleCodes
      });
    }

    return output;
  }

  async listAvailableRoles(actor: AuthUser) {
    const roles = await this.prisma.roleCatalog.findMany({
      where: {
        OR: [{ tenantId: null }, { tenantId: actor.tenantId }]
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }]
    });

    const output: Array<{
      id: string;
      code: string;
      name: string;
      isSystem: boolean;
    }> = [];
    for (const roleRecord of roles) {
      output.push({
        id: roleRecord.id,
        code: roleRecord.code,
        name: roleRecord.name,
        isSystem: roleRecord.isSystem
      });
    }
    return output;
  }

  async createUser(
    actor: AuthUser,
    payload: CreateUserDto,
    context: { ipAddress?: string; userAgent?: string }
  ) {
    const normalizedUsername = payload.username.trim().toLowerCase();
    const normalizedEmail = payload.email.trim().toLowerCase();
    const normalizedRole = payload.roleCode.trim().toUpperCase();
    const mfaEnabled = Boolean(payload.mfaEnabled);

    if (mfaEnabled && !payload.mfaCode) {
      throw new BadRequestException(
        "Si activa MFA debe enviar un codigo mfaCode para el usuario."
      );
    }

    const existingByUsername = await this.prisma.user.findFirst({
      where: {
        tenantId: actor.tenantId,
        username: normalizedUsername,
        deletedAt: null
      }
    });

    if (existingByUsername) {
      throw new ConflictException("Ya existe un usuario con ese username");
    }

    const existingByEmail = await this.prisma.user.findFirst({
      where: {
        tenantId: actor.tenantId,
        email: normalizedEmail,
        deletedAt: null
      }
    });

    if (existingByEmail) {
      throw new ConflictException("Ya existe un usuario con ese email");
    }

    const role = await this.prisma.roleCatalog.findFirst({
      where: {
        code: normalizedRole,
        OR: [{ tenantId: null }, { tenantId: actor.tenantId }]
      }
    });

    if (!role) {
      throw new NotFoundException("Rol no encontrado para este tenant");
    }

    const bcryptRounds = Number(process.env.BCRYPT_ROUNDS ?? "12");
    const passwordHash = await bcrypt.hash(payload.password, bcryptRounds);
    const userId = randomUUID();
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.create({
        data: {
          id: userId,
          tenantId: actor.tenantId,
          username: normalizedUsername,
          email: normalizedEmail,
          passwordHash,
          mfaEnabled,
          mfaSecretEnc: mfaEnabled ? payload.mfaCode ?? null : null,
          failedLoginAttempts: 0,
          blockedUntil: null,
          isActive: true
        }
      }),
      this.prisma.userRole.create({
        data: {
          id: randomUUID(),
          tenantId: actor.tenantId,
          userId,
          roleId: role.id,
          validFrom: now,
          isActive: true
        }
      })
    ]);

    await this.auditService.record({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      eventCategory: "RBAC",
      eventName: "users.created",
      targetTable: "users",
      targetId: userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      payload: {
        newUserId: userId,
        username: normalizedUsername,
        roleCode: role.code,
        mfaEnabled
      }
    });

    return {
      id: userId,
      username: normalizedUsername,
      email: normalizedEmail,
      roleCode: role.code,
      isActive: true,
      mfaEnabled
    };
  }

  async updateUserStatus(
    actor: AuthUser,
    userId: string,
    payload: UpdateUserStatusDto,
    context: { ipAddress?: string; userAgent?: string }
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: actor.tenantId,
        deletedAt: null
      }
    });

    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }

    if (actor.id === user.id && !payload.isActive) {
      throw new BadRequestException("No puede desactivar su propio usuario");
    }

    const updated = await this.prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        isActive: payload.isActive
      }
    });

    await this.auditService.record({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      eventCategory: "RBAC",
      eventName: "users.status.updated",
      targetTable: "users",
      targetId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      payload: {
        targetUserId: user.id,
        isActive: payload.isActive
      }
    });

    return {
      id: updated.id,
      username: updated.username,
      isActive: updated.isActive
    };
  }
}
