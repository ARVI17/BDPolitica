import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";
import { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { Sensitive } from "../common/decorators/sensitive.decorator";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { CreateUserDto } from "./dto/create-user.dto";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth("access-token")
@ApiHeader({
  name: "x-tenant-id",
  required: true
})
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions("usuarios.manage")
  @ApiOperation({
    summary: "Lista usuarios del tenant con filtros"
  })
  listUsers(@CurrentUser() user: AuthUser, @Query() query: ListUsersQueryDto) {
    return this.usersService.listUsers(user, query);
  }

  @Get("roles")
  @Permissions("usuarios.manage")
  @ApiOperation({
    summary: "Lista roles disponibles para asignacion de usuarios"
  })
  listRoles(@CurrentUser() user: AuthUser) {
    return this.usersService.listAvailableRoles(user);
  }

  @Post()
  @Permissions("usuarios.manage")
  @Sensitive()
  @ApiOperation({
    summary: "Crea un usuario nuevo en el tenant y le asigna rol inicial"
  })
  createUser(
    @CurrentUser() user: AuthUser,
    @Body() payload: CreateUserDto,
    @Req() request: Request
  ) {
    return this.usersService.createUser(user, payload, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]
    });
  }

  @Patch(":userId/status")
  @Permissions("usuarios.manage")
  @Sensitive()
  @ApiOperation({
    summary: "Activa o desactiva un usuario"
  })
  updateUserStatus(
    @CurrentUser() user: AuthUser,
    @Param("userId") userId: string,
    @Body() payload: UpdateUserStatusDto,
    @Req() request: Request
  ) {
    return this.usersService.updateUserStatus(user, userId, payload, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]
    });
  }
}
