import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { JwtPayload } from "../interfaces/jwt-payload.interface";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
private readonly logger = new Logger(JwtStrategy.name);

    constructor(private readonly configService: ConfigService) {
        const jwtSecret = configService.get<string>('JWT_SECRET');
        if (!jwtSecret) {
            throw new Error('JWT_SECRET is not defined in environment variables');
        }
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: jwtSecret,
        });

        this.logger.log('JwtStrategy initialized');
    }

    async validate(payload: JwtPayload): Promise<any> {
        if (!payload || !payload.sub || !payload.email || !payload.role) {
            this.logger.warn('Invalid JWT payload received');
            throw new UnauthorizedException('Invalid token');
        }
        return {
            userId: payload.sub,
            email: payload.email,
            role: payload.role,
        };
    }
}