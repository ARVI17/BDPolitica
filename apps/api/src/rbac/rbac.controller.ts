import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { Sensitive } from "../common/decorators/sensitive.decorator";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { AssignRoleDto } from "./dto/assign-role.dto";
import { RbacService } from "./rbac.service";

@ApiTags("rbac")
@ApiBearerAuth("access-token")
@ApiHeader({
  name: "x-tenant-id",
  required: true
})
@Controller("rbac")
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get("me-permissions")
  @Permissions("personas.read")
  @ApiOperation({
    summary: "Permisos efectivos del usuario autenticado"
  })
  mePermissions(@CurrentUser() user: AuthUser) {
    return this.rbacService.getPermissionSummary(user);
  }

  @Get("admin-security-status")
  @Permissions("usuarios.manage")
  @Sensitive()
  @ApiOperation({
    summary: "Endpoint sensible para comprobar enforcement de MFA admin"
  })
  adminSecurityStatus(@CurrentUser() user: AuthUser) {
    return {
      status: "ok",
      userId: user.id,
      mfaVerified: user.mfaVerified
    };
  }

  @Post("users/:userId/assign-role")
  @Permissions("usuarios.manage")
  @Sensitive()
  @ApiOperation({
    summary: "Asigna un rol activo a un usuario del tenant y revoca los roles activos previos"
  })
  async assignRole(
    @CurrentUser() user: AuthUser,
    @Param("userId") userId: string,
    @Body() payload: AssignRoleDto,
    @Req() request: Request
  ) {
    return this.rbacService.assignUserRole(user, userId, payload, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]
    });
  }
}
