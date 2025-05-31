import { BadRequestException, Body, Controller, Get, HttpCode, Logger, Post, Query, Request, UnauthorizedException, UseGuards } from '@nestjs/common';
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

    @Public()
    @Get('validate-email')
    @HttpCode(200)
    public async validateEmail(@Query('token') token: string): Promise<{ message: string }> {
        this.logger.log(`Validating email with token: ${token}`);
        if (!token) {
            this.logger.error('Email validation token is missing');
            throw new BadRequestException('Email validation token is required');
        }
        await this.authService.validateTokenEmail(token);
        return { message: 'Email validated successfully' };
    }
}
