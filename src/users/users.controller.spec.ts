import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from './enums/user-role.enum';
import { Logger } from '@nestjs/common';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockFile: Express.Multer.File = {
    fieldname: 'profileImage',
    originalname: 'test-image.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024 * 1024,
    destination: '/tmp',
    filename: 'test-image.jpg',
    path: '/tmp/test-image.jpg',
    buffer: Buffer.from('test'),
    stream: require('stream').Readable.from(Buffer.from('test')),
  };

  const mockCreateUserDto: CreateUserDto = {
    email: 'test@example.com',
    password: 'Password123!',
    name: 'Test name',
    role: UserRole.ADMIN,
    phone: '1234567890!'
  };

  const mockCreatedUser = {
    id: 'user-123',
    ...mockCreateUserDto,
    createdAt: new Date(),
    updatedAt: new Date(),
    profileImageUrl: 'https://example.com/image.jpg',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            create: jest.fn().mockResolvedValue(mockCreatedUser),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  describe('createUser', () => {
    it('should create a user without profile image', async () => {
      const result = await controller.createUser(mockCreateUserDto);

      expect(usersService.create).toHaveBeenCalledWith(mockCreateUserDto, undefined);
      expect(result).toEqual(expect.objectContaining({
        id: mockCreatedUser.id,
        email: mockCreatedUser.email,
        name: mockCreatedUser.name,
        role: mockCreatedUser.role,
      }));
    });

    it('should create a user with profile image', async () => {
      const result = await controller.createUser(mockCreateUserDto, mockFile);

      expect(usersService.create).toHaveBeenCalledWith(mockCreateUserDto, mockFile);
      expect(result).toEqual(expect.objectContaining({
        id: mockCreatedUser.id,
        email: mockCreatedUser.email,
        name: mockCreatedUser.name,
        role: mockCreatedUser.role,
        profileImageUrl: mockCreatedUser.profileImageUrl,
      }));
    });

    it('should log user creation attempt', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'log');
      
      await controller.createUser(mockCreateUserDto);

      expect(loggerSpy).toHaveBeenCalledWith(`Creating user: ${mockCreateUserDto.email}`);
    });

    it('should log profile image details when image is provided', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'log');
      
      await controller.createUser(mockCreateUserDto, mockFile);

      expect(loggerSpy).toHaveBeenCalledWith(
        `Image profile file received: ${mockFile.originalname}, size: ${mockFile.size} bytes`
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      jest.spyOn(usersService, 'create').mockRejectedValue(error);

      await expect(controller.createUser(mockCreateUserDto))
        .rejects
        .toThrow(error);
    });
  });
});

