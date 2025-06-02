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
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';

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
  @ApiResponse({ status: 201, description: 'User created successfully.', type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({ status: 409, description: 'The provided email is already in use.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
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
  
  @ApiBearerAuth()
  @Get(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Fetch a user by their ID (Admin or self)' })
  @ApiParam({ name: 'id', description: 'User ID (UUID)', type: String, example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' })
  @ApiResponse({ status: 200, description: 'User found.', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 403, description: 'Access denied.' })
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
  
  @ApiBearerAuth()
  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'List all users. admin only' })
  @ApiQuery({ name: 'name', required: false, type: String, description: 'Filter by name' })
  @ApiQuery({ name: 'email', required: false, type: String, description: 'Filter by email' })
  @ApiQuery({ name: 'role', required: false, enum: UserRole, description: 'Filter by role' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit items per page (default 10, max 50)', schema: { default: 10, minimum:1, maximum:50 } })
  @ApiQuery({ name: 'lastEvaluatedKey', required: false, type: String, description: 'Key to continue pagination (JSON stringified)'})
  @ApiResponse({ status: 200, description: 'List of users and pagination information.', schema: {
    type: 'object',
    properties: {
        users: { type: 'array', items: { $ref: '#src/users/dto/UserResponseDto'}},
        count: { type: 'integer', example: 10},
        lastEvaluatedKey: { type: 'object', example: {"id": {"S": "some-id"}}, nullable: true, description: 'Key for the next page, if it exists.'}
    }
  }})
  @ApiResponse({ status: 403, description: 'Access denied.' })
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

  @ApiBearerAuth()
  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update an existing user. (Self only)' })
  @ApiParam({ name: 'id', description: 'ID of the user to be updated (UUID)', type: String })
  @ApiBody({ type: UpdateUserDto, description: 'Fields to be updated. All are optional.' })
  @ApiResponse({ status: 200, description: 'User updated successfully.', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 403, description: 'Access denied.'})
  @ApiResponse({ status: 409, description: 'The new email is already in use.'})
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

  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft delete a user (Admin or self)' })
  @ApiParam({ name: 'id', description: 'ID of the user to be soft deleted (UUID)', type: String })
  @ApiResponse({ status: 204, description: 'User deleted successfully.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 403, description: 'Access denied.' })
  @ApiResponse({ status: 400, description: 'User is already inactive.' })
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