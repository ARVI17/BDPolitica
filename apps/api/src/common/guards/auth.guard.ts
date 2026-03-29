import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "../../auth/auth.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Token de acceso requerido");
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const user = this.authService.decodeAccessToken(token);

    if (!user) {
      throw new UnauthorizedException("Token invalido");
    }

    request.user = user;
    return true;
  }
}
