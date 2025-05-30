import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpCode,
  HttpStatus,
  Logger,
  Get,
  Param,
  Req,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express'; 
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto'; 
import { Express } from 'express'; 
import { S3UploadFile } from 'src/aws/interfaces/s3-upload.interface';
import { UserRole } from './enums/user-role.enum';
import { Public } from 'src/auth/decorators/isPublic.decorator';
import { AuthenticatedRequest } from './interfaces/auth-request.interface';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}
  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('profileImage')) 
  public async createUser(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile(
      new ParseFilePipe({ 
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), 
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/i }),
        ],
        fileIsRequired: false, 
      }),
    ) profileImageFile?: Express.Multer.File, 
  ): Promise<UserResponseDto> {
    this.logger.log(`Creating user: ${createUserDto.email}`);
    if (profileImageFile) {
      this.logger.log(`Image profile file received: ${profileImageFile.originalname}, size: ${profileImageFile.size} bytes`);
    }

    const user = await this.usersService.create(createUserDto, profileImageFile);
    
    return new UserResponseDto({
      ...user,
      role: user.role as UserRole,
    });
  }

  @Get(':id')
  async getUser(@Param('id') id: string, @Req() request: AuthenticatedRequest): Promise<UserResponseDto> {
    this.logger.log(`Getting user: ${id}`);

    const authUser = request.user;
    if(authUser.role !== 'ADMIN' && authUser.userId !== id) {
      this.logger.warn(`Unauthorized access attempt by user: ${authUser.userId} to get user: ${id}`);
      throw new ForbiddenException('You do not have permission to access this resource');
    }
    const user = await this.usersService.findUserById(id);

    if (!user) {
      this.logger.warn(`User not found: ${id}`);
      throw new NotFoundException('User not found');
    }

    const { password, ...userResponseDto } = user;
    return new UserResponseDto({
      ...userResponseDto,
      role: user.role as UserRole,
    });
  }
}