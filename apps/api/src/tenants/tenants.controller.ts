import { Controller, Get, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { AuditService } from "../audit/audit.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { Sensitive } from "../common/decorators/sensitive.decorator";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { TenantsService } from "./tenants.service";

@ApiTags("tenants")
@ApiBearerAuth("access-token")
@ApiHeader({
  name: "x-tenant-id",
  required: true
})
@Controller("tenants")
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly auditService: AuditService
  ) {}

  @Get("me")
  @Permissions("personas.read")
  @Sensitive()
  @ApiOperation({
    summary: "Resumen del tenant y usuario autenticado"
  })
  async me(@CurrentUser() user: AuthUser, @Req() request: Request) {
    const tenant = await this.tenantsService.getTenantById(user.tenantId);

    await this.auditService.record({
      tenantId: user.tenantId,
      actorUserId: user.id,
      eventCategory: "CRUD",
      eventName: "tenant.me.read",
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]
    });

    return {
      tenant,
      user: {
        id: user.id,
        username: user.username,
        roles: user.roles,
        permissions: user.permissions,
        mfaVerified: user.mfaVerified
      }
    };
  }
}
