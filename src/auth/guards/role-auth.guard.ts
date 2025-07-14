import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core/services/reflector.service";
import { UserRole } from "src/users/enums/user-role.enum";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { AuthenticatedRequest } from "src/users/interfaces/auth-request.interface";

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass()
        ]);

        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request: AuthenticatedRequest = context.switchToHttp().getRequest();
        const { user } = request;

        if (!user || !user.role) {
            return false;
        }

        const hasRole = requiredRoles.some(role => user.role === role);

        if (!hasRole) {
            throw new ForbiddenException('You do not have permission to access this resource');
        }

        return true;
    }
}