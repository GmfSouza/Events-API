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

describe('AuthService - generateToken', () => {
  let authService: AuthService;
  let jwtService: JwtService;

  const mockFullUser: User = {
    id: 'user-id-123',
    name: 'Test User Full',
    email: 'testfull@example.com',
    password: 'hashedPasswordPlaceholder', 
    phone: '1234567890',
    role: 'participant', 
    profileImageUrl: 'http://example.com/image.jpg',
    isActive: true,
    isEmailValidated: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockExpectedToken = 'mocked.jwt.access.token';

  const mockJwtService = {
    sign: jest.fn().mockReturnValue(mockExpectedToken),
  };

  const mockUsersService = {
    findOneByEmail: jest.fn(), 
  };

  const mockDynamoDbService = {
    docClient: { 
      send: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'DYNAMODB_TABLE_USERS') {
        return 'users-table-test';
      }
      return undefined;
    }),
  };


  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DynamoDbService, useValue: mockDynamoDbService }, 
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService); 
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  it('should call jwtService.sign with the correct payload structure', async () => {
    await (authService as any).generateToken(mockFullUser);

    const expectedPayload: JwtPayload = {
      sub: mockFullUser.id,
      email: mockFullUser.email,
      role: mockFullUser.role,
    };

    expect(jwtService.sign).toHaveBeenCalledTimes(1);
    expect(jwtService.sign).toHaveBeenCalledWith(expectedPayload);
  });

  it('should return an object containing the access_token generated by jwtService', async () => {
    const result = await (authService as any).generateToken(mockFullUser);

    expect(result).toBeDefined();
    expect(result).toHaveProperty('access_token');
    expect(result.access_token).toBe(mockExpectedToken);
  });

  it('should log that it is generating a token', async () => {
    const loggerSpy = jest.spyOn((authService as any).logger, 'log');
    
    await (authService as any).generateToken(mockFullUser);

    expect(loggerSpy).toHaveBeenCalledWith(
      `Generating JWT token for user with email ${mockFullUser.email}`
    );
    
    loggerSpy.mockRestore(); 
  });
});

describe('AuthService - login', () => {
  let authService: AuthService;
  let jwtService: JwtService;

  const mockUser = {
    id: '123',
    name: 'Test User',
    email: 'test@example.com',
    password: 'testPassword!',
    phone: '1234567890',
    role: 'user',
    profileImageUrl: 'http://example.com/image.jpg',
    isActive: true,
    isEmailValidated: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock.jwt.token'),
  };

  const mockUsersService = {
    findUserByEmail: jest.fn(),
  };

  const mockDynamoDbService = {
    docClient: {
      send: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('users-table'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
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
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  it('should successfully generate and return an access token', async () => {
    const result = await authService.login(mockUser);

    expect(result).toHaveProperty('access_token');
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: mockUser.id,
      email: mockUser.email,
      role: mockUser.role,
    });
    expect(result.access_token).toBe('mock.jwt.token');
  });

  it('should throw UnauthorizedException when email is missing', async () => {
    const userWithoutEmail = {
      id: '123',
      name: 'Test User',
      email: undefined as any,
      phone: '1234567890',
      role: 'user',
      profileImageUrl: 'http://example.com/image.jpg',
      isActive: true,
      isEmailValidated: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await expect(authService.login(userWithoutEmail)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when role is missing', async () => {
    const userWithoutRole = {
      id: '123',
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
      role: undefined as any,
      profileImageUrl: 'http://example.com/image.jpg',
      isActive: true,
      isEmailValidated: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await expect(authService.login(userWithoutRole)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should generate token with correct payload structure', async () => {
    await authService.login(mockUser);

    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: mockUser.id,
      email: mockUser.email,
      role: mockUser.role,
    });
  });

  it('should handle the case when JwtService throws an error', async () => {
    mockJwtService.sign.mockImplementationOnce(() => {
      throw new Error('JWT signing error');
    });

    await expect(authService.login(mockUser)).rejects.toThrow('JWT signing error');
  });
});
