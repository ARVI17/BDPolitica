import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  Res,
  UnauthorizedException
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";
import { Request, Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @ApiOperation({
    summary: "Autentica usuario y emite access + refresh token rotativo"
  })
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const loginResult = await this.authService.login(body, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]
    });

    response.cookie(
      "refresh_token",
      loginResult.refreshToken,
      this.authService.getRefreshCookieOptions()
    );

    return loginResult;
  }

  @Public()
  @Post("refresh")
  @ApiOperation({
    summary: "Rota refresh token y emite nuevo access token"
  })
  @ApiBody({
    type: RefreshTokenDto
  })
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const tokenFromCookie = request.cookies?.refresh_token as string | undefined;
    const refreshToken = body.refreshToken ?? tokenFromCookie;
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token requerido");
    }

    const refreshResult = await this.authService.refresh(refreshToken, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]
    });

    response.cookie(
      "refresh_token",
      refreshResult.refreshToken,
      this.authService.getRefreshCookieOptions()
    );

    return refreshResult;
  }

  @Post("logout-all")
  @ApiBearerAuth("access-token")
  @ApiHeader({
    name: "x-tenant-id",
    required: true
  })
  @ApiOperation({
    summary: "Revoca todos los refresh tokens activos del usuario autenticado"
  })
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const revokedCount = await this.authService.logoutAll(user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]
    });

    response.clearCookie("refresh_token", {
      ...this.authService.getRefreshCookieOptions(),
      maxAge: 0
    });

    return {
      revokedCount
    };
  }

  @Get("me")
  @ApiBearerAuth("access-token")
  @ApiHeader({
    name: "x-tenant-id",
    required: true
  })
  me(
    @CurrentUser() user: AuthUser,
    @Headers("x-tenant-id") tenantHeader: string
  ) {
    return {
      ...user,
      activeTenantHeader: tenantHeader
    };
  }
}
