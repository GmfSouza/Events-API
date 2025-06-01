import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { DynamoDbService } from 'src/aws/dynamodb/dynamodb.service';
import { ConfigService } from '@nestjs/config';
import { S3Service } from 'src/aws/s3/s3.service';
import { MailService } from 'src/mail/mail.service';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

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
    // Arrange
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
    const userId = 'test-user-id';
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
