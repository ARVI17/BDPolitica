import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class TenantScopeGuard implements CanActivate {
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
    const user = request.user;
    const tenantHeader = request.headers["x-tenant-id"] as string | undefined;

    if (!user) {
      throw new ForbiddenException("Usuario no autenticado");
    }

    if (!tenantHeader) {
      throw new ForbiddenException("Header x-tenant-id requerido");
    }

    if (tenantHeader !== user.tenantId) {
      throw new ForbiddenException(
        "Acceso denegado: el tenant no coincide con la sesion"
      );
    }

    return true;
  }
}
