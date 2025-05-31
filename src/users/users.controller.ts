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
  Patch,
  Query,
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
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/find-users-query.dto';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}
  @Public()
  @Post()
  @HttpCode(201)
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

  @HttpCode(200)
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

  @Get()
  @HttpCode(200)
  async getAll(@Query() listUserDto: ListUsersDto, @Req() request: AuthenticatedRequest): Promise<{ items: UserResponseDto[]; total: number; lastEvaluatedKey?: Record<string, any>}> {
    this.logger.log(`Listing users with query: ${JSON.stringify(listUserDto)}`);

    const authUser = request.user;
    if(authUser.role !== 'ADMIN') {
      this.logger.warn(`Unauthorized access attempt by user: ${authUser.userId} to list users`);
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    const result = await this.usersService.findAllUsers(listUserDto);

    return {
      items: result.users.map(user => new UserResponseDto({
        ...user,
        role: user.role as UserRole,
      })),
      total: result.total,
      lastEvaluatedKey: result.lastEvaluatedKey,
    };
  }

  @HttpCode(200)
  @Patch(':id')
  async updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Req() request: AuthenticatedRequest): Promise<UserResponseDto> {
    this.logger.log(`Updating user: ${id}`);
    const authUser = request.user;
    if(authUser.userId !== id) {
      this.logger.warn(`Unauthorized access attempt by user: ${authUser.userId} to update user: ${id}`);
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    const updatedUser = await this.usersService.update(id, updateUserDto);
    return new UserResponseDto({
      ...updatedUser,
      role: updatedUser.role as UserRole,
    });
  }
}