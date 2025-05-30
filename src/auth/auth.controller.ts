import { Body, Controller, HttpCode, Logger, Post, Request, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthRequest } from './interfaces/auth-req.interface';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/isPublic.decorator';

@Controller()
export class AuthController {
    private readonly logger = new Logger(AuthController.name);
    constructor(private readonly authService: AuthService) {}

    @Public()
    @UseGuards(LocalAuthGuard)
    @Post('login')
    @HttpCode(200)
    public async login(@Request() req: AuthRequest, @Body() loginDto: LoginDto): Promise<{ access_token: string }>  {
        return this.authService.login(req.user);
    }
}
