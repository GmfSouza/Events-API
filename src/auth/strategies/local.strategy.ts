import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import { AuthService } from "../auth.service";
import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { User } from "src/users/interfaces/user.interface";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    private readonly logger = new Logger(LocalStrategy.name);
    constructor(private readonly authService: AuthService) {
        super({
            usernameField: 'email',
            passwordField: 'password',
        });
        this.logger.log('LocalStrategy initialized');
    }

    async validate(email: string, password: string): Promise<any> {
        this.logger.log(`Validating user with email ${email}`);
        const user = await this.authService.validateUser(email, password);
        if(!user) {
            throw new UnauthorizedException('Invalid credentials');
        }
        return user;
    }
}