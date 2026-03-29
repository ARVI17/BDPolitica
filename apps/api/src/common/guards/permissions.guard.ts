import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { SENSITIVE_KEY } from "../decorators/sensitive.decorator";
import { AuthUser } from "../interfaces/auth-user.interface";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) {
      throw new ForbiddenException("Usuario no autenticado");
    }

    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    const isSensitive = this.reflector.getAllAndOverride<boolean>(SENSITIVE_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (requiredPermissions.length > 0 && !this.hasAllPermissions(user, requiredPermissions)) {
      throw new ForbiddenException("Permisos insuficientes");
    }

    if (isSensitive && user.roles.includes("ADMIN") && !user.mfaVerified) {
      throw new ForbiddenException("MFA requerido para esta operacion");
    }

    return true;
  }

  private hasAllPermissions(user: AuthUser, requiredPermissions: string[]): boolean {
    if (user.permissions.includes("*")) {
      return true;
    }

    const grantedPermissions = new Set(user.permissions);
    return requiredPermissions.every((permission) => grantedPermissions.has(permission));
  }
}
