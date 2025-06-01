import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { DynamoDbService } from 'src/aws/dynamodb/dynamodb.service';
import { ConfigService } from '@nestjs/config';
import { S3Service } from 'src/aws/s3/s3.service';
import { MailService } from 'src/mail/mail.service';
import { GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ScanCommand } from '@aws-sdk/client-dynamodb';
import { BadRequestException, ConflictException, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { ListUsersDto } from './dto/find-users-query.dto';
import { UserRole } from './enums/user-role.enum';
import { User } from './interfaces/user.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import { hash } from 'bcrypt';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
});

jest.mock('bcrypt');
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mocked-uuid'),
}));

describe('UsersService - create', () => {
  let service: UsersService;
  let dynamoDbService: jest.Mocked<DynamoDbService>;
  let s3Service: jest.Mocked<S3Service>;
  let mailService: jest.Mocked<MailService>;
  
  const mockConfigService = {
    get: jest.fn().mockReturnValue('mock-table-name'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: DynamoDbService,
          useValue: {
            docClient: {
              send: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: S3Service,
          useValue: {
            uploadFile: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendEmailVerification: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    dynamoDbService = module.get<DynamoDbService>(DynamoDbService) as jest.Mocked<DynamoDbService>;
    s3Service = module.get<S3Service>(S3Service) as jest.Mocked<S3Service>;
    mailService = module.get<MailService>(MailService) as jest.Mocked<MailService>;

    jest.spyOn(service, 'findUserByEmail');
  });

  const mockCreateUserDto: CreateUserDto = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    phone: '1234567890',
    role: 'user',
  };

  it('should successfully create a user without profile image', async () => {
    (service.findUserByEmail as jest.Mock).mockResolvedValue(null);
    (dynamoDbService.docClient.send as jest.Mock).mockResolvedValue({});
    (jest.spyOn(bcrypt, 'hash') as any).mockResolvedValue('hashed-password');

    const result = await service.create(mockCreateUserDto);

    expect(result).toBeDefined();
    expect(result.id).toBe('mocked-uuid');
    expect(result.name).toBe(mockCreateUserDto.name);
    expect(result.email).toBe(mockCreateUserDto.email);
    expect(result.isActive).toBe(true);
    expect(result.isEmailValidated).toBe(false);
    expect(mailService.sendEmailVerification).toHaveBeenCalled();
  });

  it('should throw ConflictException if user email already exists', async () => {
    (service.findUserByEmail as jest.Mock).mockResolvedValue({ 
      id: 'existing-id',
      email: mockCreateUserDto.email 
    });

    await expect(service.create(mockCreateUserDto))
      .rejects
      .toThrow(ConflictException);
  });

  it('should successfully create a user with profile image', async () => {
    (service.findUserByEmail as jest.Mock).mockResolvedValue(null);
    (dynamoDbService.docClient.send as jest.Mock).mockResolvedValue({});
    
    const mockFile = {
      buffer: Buffer.from('test'),
      originalname: 'test.jpg',
    } as Express.Multer.File;

    s3Service.uploadFile.mockResolvedValue({ 
      Location: 'https://mock-s3-url/image.jpg',
      Key: 'mocked-uuid',
      Bucket: 'user-profiles'
    });

    const result = await service.create(mockCreateUserDto, mockFile);

    expect(result.profileImageUrl).toBe('https://mock-s3-url/image.jpg');
    expect(s3Service.uploadFile).toHaveBeenCalledWith(
      mockFile,
      'user-profiles',
      'mocked-uuid'
    );
  });

  it('should handle S3 upload failure', async () => {
    (service.findUserByEmail as jest.Mock).mockResolvedValue(null);
    
    const mockFile = {
      buffer: Buffer.from('test'),
      originalname: 'test.jpg',
    } as Express.Multer.File;

    s3Service.uploadFile.mockRejectedValue(new Error('S3 upload failed'));

    await expect(service.create(mockCreateUserDto, mockFile))
      .rejects
      .toThrow(InternalServerErrorException);
  });

  it('should handle DynamoDB error', async () => {
    (service.findUserByEmail as jest.Mock).mockResolvedValue(null);
    (dynamoDbService.docClient.send as jest.Mock).mockRejectedValue(new Error('DynamoDB error'));

    await expect(service.create(mockCreateUserDto))
      .rejects
      .toThrow(InternalServerErrorException);
  });

  it('should handle email verification failure gracefully', async () => {
    (service.findUserByEmail as jest.Mock).mockResolvedValue(null);
    (dynamoDbService.docClient.send as jest.Mock).mockResolvedValue({});
    mailService.sendEmailVerification.mockRejectedValue(new Error('Email failed'));

    const result = await service.create(mockCreateUserDto);

    expect(result).toBeDefined();
    expect(result.id).toBe('mocked-uuid');
  });
});

describe('UsersService - findUserByEmail', () => {
  let service: UsersService;
  let dynamoDbService: DynamoDbService;

  const mockUser = {
    id: 'test-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    isActive: true,
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
        UsersService,
        {
          provide: DynamoDbService,
          useValue: mockDynamoDbService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: S3Service,
          useValue: {},
        },
        {
          provide: MailService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    dynamoDbService = module.get<DynamoDbService>(DynamoDbService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return a user when found by email', async () => {
    const email = 'test@example.com';
    mockDynamoDbService.docClient.send.mockResolvedValueOnce({
      Items: [mockUser],
    });

    const result = await service.findUserByEmail(email);

    expect(result).toEqual(mockUser);
    expect(mockDynamoDbService.docClient.send).toHaveBeenCalledWith(
      expect.any(QueryCommand)
    );
    expect(mockDynamoDbService.docClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          TableName: 'test-table',
          IndexName: 'email-index',
          KeyConditionExpression: 'email = :emailValue',
          ExpressionAttributeValues: {
            ':emailValue': email,
          },
          Limit: 1,
        },
      })
    );
  });

  it('should return null when user is not found', async () => {
    const email = 'nonexistent@example.com';
    mockDynamoDbService.docClient.send.mockResolvedValueOnce({
      Items: [],
    });

    const result = await service.findUserByEmail(email);

    expect(result).toBeNull();
    expect(mockDynamoDbService.docClient.send).toHaveBeenCalledTimes(1);
  });

  it('should return null when DynamoDB query throws an error', async () => {
    const email = 'test@example.com';
    mockDynamoDbService.docClient.send.mockRejectedValueOnce(
      new Error('DynamoDB error')
    );

    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error');

    const result = await service.findUserByEmail(email);

    expect(result).toBeNull();
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      `Error to get user by email: ${email}`,
      expect.any(String)
    );
    expect(mockDynamoDbService.docClient.send).toHaveBeenCalledTimes(1);
  });

  it('should use correct query parameters', async () => {
    const email = 'test@example.com';
    mockDynamoDbService.docClient.send.mockResolvedValueOnce({
      Items: [mockUser],
    });

    await service.findUserByEmail(email);

    expect(mockDynamoDbService.docClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: 'test-table',
          IndexName: 'email-index',
          Limit: 1,
        }),
      })
    );
  });
});

describe('UsersService - findUserById', () => {
  let service: UsersService;
  let dynamoDbService: DynamoDbService;

  const mockUser = {
    id: 'test-id',
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    isActive: true,
  };

  const mockDynamoDbService = {
    docClient: {
      send: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-table-name'),
  };

  const mockS3Service = {};
  const mockMailService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: DynamoDbService,
          useValue: mockDynamoDbService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    dynamoDbService = module.get<DynamoDbService>(DynamoDbService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should successfully find a user by ID', async () => {
    const userId = 'test-id';
    mockDynamoDbService.docClient.send.mockResolvedValueOnce({
      Item: mockUser,
    });

    const result = await service.findUserById(userId);

    expect(result).toEqual(mockUser);
    expect(mockDynamoDbService.docClient.send).toHaveBeenCalledWith(
      expect.any(GetCommand)
    );
    expect(mockDynamoDbService.docClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          TableName: 'test-table-name',
          Key: { id: userId },
        },
      })
    );
  });

  it('should return null when user is not found', async () => {
    const userId = 'non-existent-id';
    mockDynamoDbService.docClient.send.mockResolvedValueOnce({
      Item: null,
    });

    const result = await service.findUserById(userId);

    expect(result).toBeNull();
    expect(mockDynamoDbService.docClient.send).toHaveBeenCalledTimes(1);
  });

  it('should throw InternalServerErrorException when DynamoDB operation fails', async () => {
    const userId = 'test-id';
    mockDynamoDbService.docClient.send.mockRejectedValueOnce(
      new Error('DynamoDB error')
    );

    await expect(service.findUserById(userId)).rejects.toThrow(
      InternalServerErrorException
    );
    expect(mockDynamoDbService.docClient.send).toHaveBeenCalledTimes(1);
  });

  it('should call DynamoDB with correct parameters', async () => {
    const userId = 'test-id';
    mockDynamoDbService.docClient.send.mockResolvedValueOnce({
      Item: mockUser,
    });

    await service.findUserById(userId);

    const expectedCommand = new GetCommand({
      TableName: 'test-table-name',
      Key: { id: userId },
    });

    expect(mockDynamoDbService.docClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expectedCommand.input,
      })
    );
  });
});

describe('UsersService - findAllUsers', () => {
  let service: UsersService;
  let dynamoDbService: DynamoDbService;

  const mockDynamoDbService = {
    docClient: {
      send: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-table'),
  };

  const mockS3Service = {};
  const mockMailService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: DynamoDbService,
          useValue: mockDynamoDbService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    dynamoDbService = module.get<DynamoDbService>(DynamoDbService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return users when no filters are applied', async () => {
    const mockResponse = {
      Items: [
        {
          id: { S: 'test-id' },
          name: { S: 'test name' },
          email: { S: 'test@example.com' },
          role: { S: 'PARTICIPANT' },
          isActive: { BOOL: true },
        },
      ],
      Count: 1,
    };

    mockDynamoDbService.docClient.send.mockResolvedValueOnce(mockResponse);

    const listUsersDto: ListUsersDto = {
      limit: 10,
    };

    const result = await service.findAllUsers(listUsersDto);

    expect(result.users).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(mockDynamoDbService.docClient.send).toHaveBeenCalledWith(
      expect.any(ScanCommand),
    );
  });

  it('should filter users by role using QueryCommand', async () => {
    const mockResponse = {
      Items: [
        {
          id: { S: 'test-id' },
          name: { S: 'test name' },
          email: { S: 'test@example.com' },
          role: { S: 'ADMIN' },
          isActive: { BOOL: true },
        },
      ],
      Count: 1,
    };

    mockDynamoDbService.docClient.send.mockResolvedValueOnce(mockResponse);

    const listUsersDto: ListUsersDto = {
      role: UserRole.ADMIN,
      limit: 10,
    };

    const result = await service.findAllUsers(listUsersDto);

    expect(result.users).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(mockDynamoDbService.docClient.send).toHaveBeenCalledWith(
      expect.any(QueryCommand),
    );
  });

  it('should handle name and email filters', async () => {
    const mockResponse = {
      Items: [
        {
          id: { S: 'test-id' },
          name: { S: 'test name' },
          email: { S: 'test@example.com' },
          isActive: { BOOL: true },
        },
      ],
      Count: 1,
    };

    mockDynamoDbService.docClient.send.mockResolvedValueOnce(mockResponse);

    const listUsersDto: ListUsersDto = {
      name: 'test name',
      email: 'test@example.com',
      limit: 10,
    };

    const result = await service.findAllUsers(listUsersDto);

    expect(result.users).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('should handle pagination with lastEvaluatedKey', async () => {
    const mockResponse = {
      Items: [
        {
          id: { S: 'test-id' },
          name: { S: 'test name' },
          email: { S: 'test@example.com' },
          isActive: { BOOL: true },
        },
      ],
      Count: 1,
      LastEvaluatedKey: { id: { S: 'test-id' } },
    };

    mockDynamoDbService.docClient.send.mockResolvedValueOnce(mockResponse);

    const listUsersDto: ListUsersDto = {
      limit: 10,
      lastEvaluatedKey: JSON.stringify({ id: 'test-id' }),
    };

    const result = await service.findAllUsers(listUsersDto);

    expect(result.lastEvaluatedKey).toBeDefined();
    expect(result.users).toHaveLength(1);
  });

  it('should throw InternalServerException when lastEvaluatedKey is invalid', async () => {
    const listUsersDto: ListUsersDto = {
      limit: 10,
      lastEvaluatedKey: 'invalid-json',
    };

    await expect(service.findAllUsers(listUsersDto)).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should throw InternalServerException when DynamoDB query fails', async () => {
    mockDynamoDbService.docClient.send.mockRejectedValueOnce(
      new Error('DynamoDB error'),
    );

    const listUsersDto: ListUsersDto = {
      limit: 10,
    };

    await expect(service.findAllUsers(listUsersDto)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});

describe('UsersService - update', () => {
  let service: UsersService;
  let dynamoDbService: jest.Mocked<DynamoDbService>;
  let mailService: jest.Mocked<MailService>;

  const mockUser: User = {
    id: 'test-id',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedPassword',
    phone: '1234567890',
    role: 'user',
    isActive: true,
    isEmailValidated: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: DynamoDbService,
          useValue: {
            docClient: {
              send: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('users-table'),
          },
        },
        {
          provide: S3Service,
          useValue: {},
        },
        {
          provide: MailService,
          useValue: {
            sendEmailVerification: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    dynamoDbService = module.get(DynamoDbService);
    mailService = module.get(MailService);

    jest.spyOn(service, 'findUserById').mockImplementation(async (id) => 
      id === mockUser.id ? mockUser : null
    );
    jest.spyOn(service, 'findUserByEmail').mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully update user name', async () => {
    const updateUserDto: UpdateUserDto = {
      name: 'Updated Name',
    };

    const mockResponse = {
      Attributes: {
        ...mockUser,
        name: updateUserDto.name,
        updatedAt: expect.any(String),
      },
    };

    (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await service.update(mockUser.id, updateUserDto);

    expect(dynamoDbService.docClient.send).toHaveBeenCalledWith(
      expect.any(UpdateCommand)
    );
    expect(result.name).toBe(updateUserDto.name);
  });

  it('should throw NotFoundException when user not found', async () => {
    const updateUserDto: UpdateUserDto = {
      name: 'Updated Name',
    };

    jest.spyOn(service, 'findUserById').mockResolvedValueOnce(null);

    await expect(service.update('non-existent-id', updateUserDto))
      .rejects
      .toThrow(NotFoundException);
  });

  it('should throw ConflictException when updating to existing email', async () => {
    const updateUserDto: UpdateUserDto = {
      email: 'existing@example.com',
    };

    jest.spyOn(service, 'findUserByEmail').mockResolvedValueOnce({
      ...mockUser,
      email: updateUserDto.email ?? '',
    });

    await expect(service.update(mockUser.id, updateUserDto))
      .rejects
      .toThrow(ConflictException);
  });

  it('should handle password update correctly', async () => {
    const updateUserDto: UpdateUserDto = {
      password: 'newPassword123',
    };

    const hashedPassword = 'hashedNewPassword';
    (hash as jest.Mock).mockResolvedValueOnce(hashedPassword);

    const mockResponse = {
      Attributes: {
        ...mockUser,
        password: hashedPassword,
        updatedAt: expect.any(String),
      },
    };

    (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await service.update(mockUser.id, updateUserDto);

    expect(hash).toHaveBeenCalledWith(updateUserDto.password, 10);
    expect(result).not.toHaveProperty('password');
  });

  it('should handle email update with verification', async () => {
    const updateUserDto: UpdateUserDto = {
      email: 'newemail@example.com',
    };

    const mockResponse = {
      Attributes: {
        ...mockUser,
        email: updateUserDto.email ?? '',
        isEmailValidated: false,
        emailValidationToken: 'mocked-uuid',
        emailValidationTokenExpires: expect.any(String),
        updatedAt: expect.any(String),
      },
    };

    (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await service.update(mockUser.id, updateUserDto);

    expect(result.email).toBe(updateUserDto.email);
    expect(result.isEmailValidated).toBe(false);
    expect(mailService.sendEmailVerification).toHaveBeenCalled();
  });

  it('should return unchanged user when no changes detected', async () => {
    const updateUserDto: UpdateUserDto = {
      name: mockUser.name,
      phone: mockUser.phone,
    };

    const result = await service.update(mockUser.id, updateUserDto);

    expect(result).toEqual(expect.objectContaining({
      id: mockUser.id,
      name: mockUser.name,
      phone: mockUser.phone,
    }));
    expect(dynamoDbService.docClient.send).not.toHaveBeenCalled();
  });

  it('should handle DynamoDB errors gracefully', async () => {
    const updateUserDto: UpdateUserDto = {
      name: 'Updated Name',
    };

    (dynamoDbService.docClient.send as jest.Mock).mockRejectedValueOnce(new Error('DynamoDB error'));

    await expect(service.update(mockUser.id, updateUserDto))
      .rejects
      .toThrow(InternalServerErrorException);
  });
});

describe('UsersService - softDelete', () => {
  let service: UsersService;
  let dynamoDbService: DynamoDbService;
  let mailService: MailService;

  const mockUser = {
    id: 'test-id',
    name: 'Test User',
    email: 'test@example.com',
    isActive: true,
  };

  const mockDynamoDbService = {
    docClient: {
      send: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-table'),
  };

  const mockS3Service = {};

  const mockMailService = {
    sendDeletedAccountNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: DynamoDbService,
          useValue: mockDynamoDbService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    dynamoDbService = module.get<DynamoDbService>(DynamoDbService);
    mailService = module.get<MailService>(MailService);

    jest.spyOn(service, 'findUserById');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully soft delete a user', async () => {
    const userId = 'test-id';
    (service.findUserById as jest.Mock).mockResolvedValue(mockUser);
    mockDynamoDbService.docClient.send.mockResolvedValue({});

    await service.softDelete(userId);

    expect(service.findUserById).toHaveBeenCalledWith(userId);
    expect(mockDynamoDbService.docClient.send).toHaveBeenCalledWith(
      expect.any(UpdateCommand)
    );
    expect(mockMailService.sendDeletedAccountNotification).toHaveBeenCalledWith(
      mockUser.name,
      mockUser.email
    );
  });

  it('should throw NotFoundException when user is not found', async () => {
    const userId = 'non-existent-user';
    (service.findUserById as jest.Mock).mockResolvedValue(null);

    await expect(service.softDelete(userId)).rejects.toThrow(NotFoundException);
    expect(service.findUserById).toHaveBeenCalledWith(userId);
    expect(mockDynamoDbService.docClient.send).not.toHaveBeenCalled();
    expect(mockMailService.sendDeletedAccountNotification).not.toHaveBeenCalled();
  });

  it('should throw BadRequestException when user is already inactive', async () => {
    const userId = 'inactive-user';
    const inactiveUser = { ...mockUser, isActive: false };
    (service.findUserById as jest.Mock).mockResolvedValue(inactiveUser);

    await expect(service.softDelete(userId)).rejects.toThrow(BadRequestException);
    expect(service.findUserById).toHaveBeenCalledWith(userId);
    expect(mockDynamoDbService.docClient.send).not.toHaveBeenCalled();
    expect(mockMailService.sendDeletedAccountNotification).not.toHaveBeenCalled();
  });

  it('should handle DynamoDB errors appropriately', async () => {
    const userId = 'test-id';
    (service.findUserById as jest.Mock).mockResolvedValue(mockUser);
    mockDynamoDbService.docClient.send.mockRejectedValue(new Error('DynamoDB error'));

    await expect(service.softDelete(userId)).rejects.toThrow('Failed to soft delete user.');
    expect(service.findUserById).toHaveBeenCalledWith(userId);
    expect(mockDynamoDbService.docClient.send).toHaveBeenCalled();
    expect(mockMailService.sendDeletedAccountNotification).not.toHaveBeenCalled();
  });

  it('should continue execution even if email notification fails', async () => {
    const userId = 'test-id';
    (service.findUserById as jest.Mock).mockResolvedValue(mockUser);
    mockDynamoDbService.docClient.send.mockResolvedValue({});
    mockMailService.sendDeletedAccountNotification.mockRejectedValue(new Error('Email error'));

    await service.softDelete(userId);

    expect(service.findUserById).toHaveBeenCalledWith(userId);
    expect(mockDynamoDbService.docClient.send).toHaveBeenCalled();
    expect(mockMailService.sendDeletedAccountNotification).toHaveBeenCalled();
  });

  it('should update user with correct parameters', async () => {
    const userId = 'test-id';
    (service.findUserById as jest.Mock).mockResolvedValue(mockUser);
    mockDynamoDbService.docClient.send.mockResolvedValue({});

    await service.softDelete(userId);

    expect(mockDynamoDbService.docClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: 'test-table',
          Key: { id: userId },
          UpdateExpression: 'SET #isActive = :isActive, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#isActive': 'isActive',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: expect.objectContaining({
            ':isActive': false,
            ':updatedAt': expect.any(String),
          }),
        }),
      })
    );
  });
});
