import { ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcrypt";
import { User } from "src/users/interfaces/user.interface";
import { UsersService } from "src/users/users.service";
import { JwtPayload } from "./interfaces/jwt-payload.interface";

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    constructor(private readonly usersService: UsersService, private readonly jwtService: JwtService) {}

    async validateUser(email: string, password: string): Promise<Omit<User, 'password'>> {
        this.logger.debug(`Validating user with email ${email}`);
        const user = await this.usersService.findUserByEmail(email);
        if (!user) {
            this.logger.warn(`User with email ${email} not found`);
            throw new NotFoundException('User not found');
        }

        if (!user.isActive) {
            this.logger.warn(`User with email ${email} is not active`);
            throw new ForbiddenException('User is not active');
        }

         if (!user.password) {
             this.logger.warn(`User with email ${email} does not have a password set`);
             throw new UnauthorizedException('User password not set');
         }
        const validPassword = await compare(password, user.password);
        if (!validPassword) {
            this.logger.warn(`Invalid password for user with email ${email}`);
            throw new UnauthorizedException('Invalid password');
        }

        const { password: _, ...result } = user;
        return result;
    }

    private async generateToken(user: User): Promise<{ access_token: string }> {
        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: user.role,
        };

        this.logger.log(`Generating JWT token for user with email ${user.email}`);
        return {
            access_token: this.jwtService.sign(payload),
        };
    }

    async login(user: User): Promise<{ access_token: string }> {
        if (!user.email || !user.password) {
            this.logger.warn('Email or password is missing in user object');
            throw new UnauthorizedException('Email and password must be provided');
        }
        await this.validateUser(user.email, user.password);
        return this.generateToken(user);
    }
}
