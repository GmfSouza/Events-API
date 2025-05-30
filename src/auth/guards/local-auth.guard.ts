import { Injectable, Logger } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
    private readonly logger = new Logger(LocalAuthGuard.name);

    constructor() {
        super();
        this.logger.log('LocalAuthGuard initialized');
    }
}