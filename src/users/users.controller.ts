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
  Delete,
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
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}
  @Public()
  @Post()
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('profileImage')) 
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiBody({
    description: 'Data of the user to be created. Profile image is optional.',
    schema: {
      type: 'object',
      required: ['name', 'email', 'password', 'phone', 'role'],
      properties: {
        name: { type: 'string', example: 'John Doe' },
        email: { type: 'string', format: 'email', example: 'john.doe@example.com' },
        password: { type: 'string', format: 'password', example: 'Password!1234', minLength: 8 },
        phone: { type: 'string', example: '+5521548796387' },
        role: { type: 'string', enum: Object.values(UserRole), default: UserRole.PARTICIPANT },
        profileImage: {
          type: 'string',
          format: 'binary',
          description: 'Optional profile image file. Supported formats: jpg, jpeg, png, webp. Max size: 5MB',
          example: 'profile.jpg',
          nullable: true,
        },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'User created successfully.', type: UserResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data.' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'The provided email is already in use.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
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
    if(authUser.role !== UserRole.ADMIN && authUser.userId !== id) {
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
    if(authUser.role !== UserRole.ADMIN) {
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

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string, @Req() request: AuthenticatedRequest): Promise<void> {
    this.logger.log(`Deleting user: ${id}`);
    const authUser = request.user;
    if(authUser.role !== UserRole.ADMIN && authUser.userId !== id) {
      this.logger.warn(`Unauthorized access attempt by user: ${authUser.userId} to delete user: ${id}`);
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    await this.usersService.softDelete(id);
  }
}