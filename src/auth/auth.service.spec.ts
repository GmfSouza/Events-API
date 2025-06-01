import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { DynamoDbService } from '../aws/dynamodb/dynamodb.service';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/interfaces/user.interface';
import { NotFoundException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from './interfaces/jwt-payload.interface';

jest.mock('bcrypt');

describe('AuthService - validateUser', () => {
  let authService: AuthService;
  let usersService: UsersService;

  const mockUser: User = {
    id: 'test-id',
    name: 'TestUser',
    email: 'test@example.com',
    password: 'testPassword!',
    phone: '1234567890',
    role: 'PARTICIPANT',
    profileImageUrl: 'http://example.com/image.jpg',
    isActive: true,
    isEmailValidated: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockUsersService = {
    findUserByEmail: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockDynamoDbService = {
    docClient: {
      send: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-table'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: DynamoDbService,
          useValue: mockDynamoDbService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully validate user with correct credentials', async () => {
    const email = 'test@example.com';
    const password = 'correctPassword';

    mockUsersService.findUserByEmail.mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await authService.validateUser(email, password);

    expect(usersService.findUserByEmail).toHaveBeenCalledWith(email);
    expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.password);
    expect(result).toEqual({
      id: mockUser.id,
      name: mockUser.name,
      email: mockUser.email,
      phone: mockUser.phone,
      role: mockUser.role,
      createdAt: mockUser.createdAt,
      updatedAt: mockUser.updatedAt,
      profileImageUrl: mockUser.profileImageUrl,
      isActive: mockUser.isActive,
      isEmailValidated: mockUser.isEmailValidated,
    });
  });

  it('should throw NotFoundException when user is not found', async () => {
    const email = 'nonexistent@example.com';
    const password = 'password';

    mockUsersService.findUserByEmail.mockResolvedValue(null);

    await expect(authService.validateUser(email, password))
      .rejects
      .toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when user is not active', async () => {
    const email = 'inactive@example.com';
    const password = 'password';

    mockUsersService.findUserByEmail.mockResolvedValue({
      ...mockUser,
      isActive: false,
    });

    await expect(authService.validateUser(email, password))
      .rejects
      .toThrow(ForbiddenException);
  });

  it('should throw UnauthorizedException when password is not set', async () => {
    const email = 'nopassword@example.com';
    const password = 'password';

    mockUsersService.findUserByEmail.mockResolvedValue({
      ...mockUser,
      password: null,
    });

    await expect(authService.validateUser(email, password))
      .rejects
      .toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when password is incorrect', async () => {
    const email = 'test@example.com';
    const password = 'wrongPassword';

    mockUsersService.findUserByEmail.mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(authService.validateUser(email, password))
      .rejects
      .toThrow(UnauthorizedException);
  });
});
