import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from './enums/user-role.enum';
import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { AuthenticatedRequest } from './interfaces/auth-request.interface';
import { ListUsersDto } from './dto/find-users-query.dto';
import { UserResponseDto } from './dto/user-response.dto';

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

describe('UsersController - getUser', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'John',
    role: UserRole.PARTICIPANT,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUsersService = {
    findUserById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return user when admin requests any user', async () => {
    const mockRequest = {
      user: { userId: 'admin-id', role: UserRole.ADMIN },
    } as AuthenticatedRequest;

    mockUsersService.findUserById.mockResolvedValue({
      ...mockUser,
      password: 'hashed-password',
    });

    const result = await controller.getUser('test-user-id', mockRequest);

    expect(result).toBeDefined();
    expect(result.id).toBe(mockUser.id);
    expect(result.email).toBe(mockUser.email);
    expect(result.role).toBe(UserRole.PARTICIPANT);
    expect(result).not.toHaveProperty('password');
    expect(usersService.findUserById).toHaveBeenCalledWith('test-user-id');
  });

  it('should return user when user requests their own profile', async () => {
    const mockRequest = {
      user: { userId: 'test-user-id', role: UserRole.PARTICIPANT },
    } as AuthenticatedRequest;

    mockUsersService.findUserById.mockResolvedValue({
      ...mockUser,
      password: 'hashed-password',
    });

    const result = await controller.getUser('test-user-id', mockRequest);

    expect(result).toBeDefined();
    expect(result.id).toBe(mockUser.id);
    expect(usersService.findUserById).toHaveBeenCalledWith('test-user-id');
  });

  it('should throw ForbiddenException when non-admin user requests another user profile', async () => {
    const mockRequest = {
      user: { userId: 'different-user-id', role: UserRole.PARTICIPANT },
    } as AuthenticatedRequest;

    await expect(
      controller.getUser('test-user-id', mockRequest)
    ).rejects.toThrow(ForbiddenException);

    expect(usersService.findUserById).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when user is not found', async () => {
    const mockRequest = {
      user: { userId: 'admin-id', role: UserRole.ADMIN },
    } as AuthenticatedRequest;

    mockUsersService.findUserById.mockResolvedValue(null);

    await expect(
      controller.getUser('non-existent-id', mockRequest)
    ).rejects.toThrow(NotFoundException);

    expect(usersService.findUserById).toHaveBeenCalledWith('non-existent-id');
  });
});

describe('UsersController - getAll', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockUsersService = {
    findAllUsers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAll', () => {
    const mockListUserDto: ListUsersDto = {
      limit: 10,
    };

    const mockAdminRequest = {
      user: {
        userId: 'admin-id',
        role: UserRole.ADMIN,
      },
    } as unknown as AuthenticatedRequest;

    const mockRegularUserRequest = {
      user: {
        userId: 'user-id',
        role: UserRole.PARTICIPANT,
      },
    } as unknown as AuthenticatedRequest;

    const mockUsers = [
      {
        id: '1',
        email: 'user1@example.com',
        name: 'User 1',
        role: UserRole.PARTICIPANT,
      },
      {
        id: '2',
        email: 'user2@example.com',
        name: 'User 2',
        role: UserRole.ADMIN,
      },
    ];

    const mockServiceResponse = {
      users: mockUsers,
      total: 2,
      lastEvaluatedKey: { id: 'last-key' },
    };

    it('should return users list when called by admin', async () => {
      mockUsersService.findAllUsers.mockResolvedValue(mockServiceResponse);

      const result = await controller.getAll(mockListUserDto, mockAdminRequest);

      expect(result).toEqual({
        items: mockUsers.map(user => ({
          ...user,
          role: user.role,
        })),
        total: 2,
        lastEvaluatedKey: { id: 'last-key' },
      });
      expect(usersService.findAllUsers).toHaveBeenCalledWith(mockListUserDto);
    });

    it('should throw ForbiddenException when called by non-admin user', async () => {
      await expect(
        controller.getAll(mockListUserDto, mockRegularUserRequest),
      ).rejects.toThrow(ForbiddenException);

      expect(usersService.findAllUsers).not.toHaveBeenCalled();
    });

    it('should handle empty result from service', async () => {
      const emptyResponse = {
        users: [],
        total: 0,
        lastEvaluatedKey: undefined,
      };

      mockUsersService.findAllUsers.mockResolvedValue(emptyResponse);

      const result = await controller.getAll(mockListUserDto, mockAdminRequest);

      expect(result).toEqual({
        items: [],
        total: 0,
        lastEvaluatedKey: undefined,
      });
    });

    it('should properly map user roles in response', async () => {
      const usersWithMixedRoles = {
        users: [
          {
            id: '1',
            email: 'user@example.com',
            name: 'Regular User',
            role: UserRole.PARTICIPANT,
          },
          {
            id: '2',
            email: 'admin@example.com',
            name: 'Admin User',
            role: UserRole.ADMIN,
          },
        ],
        total: 2,
        lastEvaluatedKey: null,
      };

      mockUsersService.findAllUsers.mockResolvedValue(usersWithMixedRoles);

      const result = await controller.getAll(mockListUserDto, mockAdminRequest);

      expect(result.items[0].role).toBe(UserRole.PARTICIPANT);
      expect(result.items[1].role).toBe(UserRole.ADMIN);
    });

    it('should pass query parameters correctly to service', async () => {
      const customListUserDto: ListUsersDto = {
        limit: 5,
      };

      mockUsersService.findAllUsers.mockResolvedValue(mockServiceResponse);

      await controller.getAll(customListUserDto, mockAdminRequest);

      expect(usersService.findAllUsers).toHaveBeenCalledWith(customListUserDto);
    });
  });
});
