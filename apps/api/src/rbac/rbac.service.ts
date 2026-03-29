import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { PrismaService } from "../prisma/prisma.service";
import { AssignRoleDto } from "./dto/assign-role.dto";

@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  getPermissionSummary(user: AuthUser) {
    return {
      userId: user.id,
      roles: user.roles,
      permissions: user.permissions,
      mfaVerified: user.mfaVerified
    };
  }

  async assignUserRole(
    actor: AuthUser,
    userId: string,
    payload: AssignRoleDto,
    context: { ipAddress?: string; userAgent?: string }
  ) {
    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: actor.tenantId,
        deletedAt: null
      }
    });

    if (!targetUser) {
      throw new NotFoundException("Usuario objetivo no encontrado en el tenant");
    }

    const role = await this.prisma.roleCatalog.findFirst({
      where: {
        code: payload.roleCode,
        OR: [{ tenantId: null }, { tenantId: actor.tenantId }]
      }
    });

    if (!role) {
      throw new NotFoundException("Rol no encontrado");
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.userRole.updateMany({
        where: {
          tenantId: actor.tenantId,
          userId: targetUser.id,
          isActive: true
        },
        data: {
          isActive: false,
          validTo: now
        }
      }),
      this.prisma.userRole.create({
        data: {
          id: randomUUID(),
          tenantId: actor.tenantId,
          userId: targetUser.id,
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
      eventName: "rbac.user_role.updated",
      targetTable: "user_roles",
      targetId: targetUser.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      payload: {
        targetUserId: targetUser.id,
        roleCode: role.code
      }
    });

    const activeRoles = await this.prisma.userRole.findMany({
      where: {
        tenantId: actor.tenantId,
        userId: targetUser.id,
        isActive: true,
        OR: [{ validTo: null }, { validTo: { gt: now } }]
      },
      include: {
        role: true
      }
    });

    const activeRoleCodes: string[] = [];
    for (const assignment of activeRoles) {
      activeRoleCodes.push(assignment.role.code);
    }

    return {
      userId: targetUser.id,
      roles: activeRoleCodes
    };
  }
}
