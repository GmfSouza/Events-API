import { BadRequestException, Body, Controller, Get, HttpCode, Logger, Post, Query, Request, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthRequest } from './interfaces/auth-req.interface';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/isPublic.decorator';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Public()
    @UseGuards(LocalAuthGuard)
    @Post('login')
    @HttpCode(200)
    @ApiOperation({ summary: 'Authenticates a user and returns a token' })
    @ApiBody({ 
        description: 'User login credentials.',
        type: LoginDto 
    })
    @ApiResponse({
        status: 200,
        description: 'Successful authentication, access token returned.',
        schema: { 
        properties: { access_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }} 
        },
    })
    @ApiResponse({ status: 401, description: 'Invalid credentials.' })
    @ApiResponse({ status: 400, description: 'Missing or incorrect login data.' })
    @ApiResponse({ status: 500, description: 'Internal server error.' })
    async login(@Request() req: AuthRequest, @Body() loginDto: LoginDto): Promise<{ access_token: string }>  {
        return this.authService.login(req.user);
    }

    @Public()
    @Get('validate-email')
    @HttpCode(200)
    @ApiOperation({ summary: 'Validates a user email using a token' })
    @ApiQuery({ name: 'token', required: true, description: 'The validation token received via email.', type: String })
    @ApiResponse({ status: 200, description: 'Email validated successfully.', schema: { example: { message: 'Your email address has been successfully validated!'}}})
    @ApiResponse({ status: 400, description: 'Invalid, expired, missing token or email already validated.' })
    @ApiResponse({ status: 500, description: 'Internal server error.' })
    async validateEmail(@Query('token') token: string): Promise<{ message: string }> {
        if (!token) {
            throw new BadRequestException('Email validation token is required');
        }
        await this.authService.validateTokenEmail(token);
        return { message: 'Email validated successfully' };
    }
}
