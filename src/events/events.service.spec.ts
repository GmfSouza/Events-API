import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { DynamoDbService } from 'src/aws/dynamodb/dynamodb.service';
import { S3Service } from 'src/aws/s3/s3.service';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/users/users.service';
import { MailService } from 'src/mail/mail.service';
import { UserRole } from 'src/users/enums/user-role.enum';
import { EventStatus } from './enums/event-status.enum';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

describe('EventsService', () => {
  let service: EventsService;
  let dynamoDbService: jest.Mocked<DynamoDbService>;
  let s3Service: jest.Mocked<S3Service>;
  let configService: jest.Mocked<ConfigService>;
  let usersService: jest.Mocked<UsersService>;
  let mailService: jest.Mocked<MailService>;

  const mockDynamoDbService = {
    docClient: {
      send: jest.fn() as jest.Mock,
    },
  };

  const mockS3Service = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        DYNAMODB_TABLE_EVENTS: 'events-table',
      };
      return config[key as keyof typeof config];
    }),
  };

  const mockUsersService = {
    findUserById: jest.fn(),
  };

  const mockMailService = {
    sendCreatedEventEmail: jest.fn(),
    sendEventDeletedEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: DynamoDbService,
          useValue: mockDynamoDbService,
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    dynamoDbService = module.get(DynamoDbService);
    s3Service = module.get(S3Service);
    configService = module.get(ConfigService);
    usersService = module.get(UsersService);
    mailService = module.get(MailService);

    configService.get.mockImplementation((key: string) => {
      if (key === 'DYNAMODB_TABLE_EVENTS') return 'events-table';
      if (key === 'S3_EVENT_IMAGE_PATH') return 'events-images';
      return null;
    });
  });

  describe('create', () => {
    const mockEventOrganizerDto = {
      id: 'organizer-id',
      name: 'Test Organizer',
      email: 'organizer@test.com',
    };
    const mockCreateEventDto = {
      name: 'Test Event',
      description: 'Test Description',
      organizer: mockEventOrganizerDto.id,
      date: new Date(Date.now() + 86400000).toISOString(),
    };

    const mockFile = {
      buffer: Buffer.from('test'),
      originalname: 'test.jpg',
      mimetype: 'image/jpeg',
    } as Express.Multer.File;

    const mockOrganizer = {
      id: 'organizer-id',
      name: 'Test Organizer',
      email: 'organizer@test.com',
      password: 'XXXXXXXX',
      phone: '1234567890',
      role: UserRole.ORGANIZER,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEmailValidated: true,
    };

    beforeEach(() => {
      jest.clearAllMocks();
      usersService.findUserById.mockResolvedValue(mockOrganizer);
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValue({
        Items: [],
      });
      s3Service.uploadFile.mockResolvedValue({
        Location: 'https://XXXXXXXXXXXXXXXXXXXXXXXXXXXX/test.jpg',
        Key: 'test-key',
        Bucket: 'test-bucket',
      });
    });

    it('should create an event successfully', async () => {
      const result = await service.create(
        mockCreateEventDto,
        mockOrganizer.id,
        mockFile,
      );

      expect(result).toBeDefined();
      expect(result.name).toBe(mockCreateEventDto.name);
      expect(result.description).toBe(mockCreateEventDto.description);
      expect(result.organizer).toEqual({
        id: mockOrganizer.id,
        name: mockOrganizer.name,
      });
      expect(dynamoDbService.docClient.send).toHaveBeenCalled();
      expect(mailService.sendCreatedEventEmail).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if organizer is not active', async () => {
      usersService.findUserById.mockResolvedValue({
        ...mockOrganizer,
        isActive: false,
      });

      await expect(
        service.create(mockCreateEventDto, 'organizer-id', mockFile),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if event date is in the past', async () => {
      const pastEventDto = {
        ...mockCreateEventDto,
        date: new Date(Date.now() - 86400000).toISOString(),
      };

      await expect(
        service.create(pastEventDto, 'organizer-id', mockFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if event name already exists', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Items: [{ name: mockCreateEventDto.name }],
      });

      await expect(
        service.create(mockCreateEventDto, 'organizer-id', mockFile),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    const mockEvent = {
      id: 'test-id',
      name: 'Test Event',
      description: 'Original description',
      organizerId: 'organizer-id',
      status: EventStatus.ACTIVE,
    };

    const mockUpdateEventDto = {
      name: 'Updated Event Name',
      description: 'Updated description',
      date: new Date(Date.now() + 86400000).toISOString(),
    };

    const mockFile = {
      buffer: Buffer.from('test'),
      originalname: 'updated.jpg',
      mimetype: 'image/jpeg',
    } as Express.Multer.File;

    beforeEach(() => {
      jest.clearAllMocks();
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Item: mockEvent,
      });
    });

    it('should update an event successfully', async () => {
      const result = await service.update(
        'test-id',
        mockUpdateEventDto,
        'organizer-id',
        mockFile,
      );

      expect(result).toBeDefined();
      expect(result.name).toBe(mockUpdateEventDto.name);
      expect(result.description).toBe(mockUpdateEventDto.description);
      expect(dynamoDbService.docClient.send).toHaveBeenCalled();
      expect(s3Service.uploadFile).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not the organizer', async () => {
      await expect(
        service.update('test-id', mockUpdateEventDto, 'different-id', mockFile),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if event date is in the past', async () => {
      const pastEventDto = {
        ...mockUpdateEventDto,
        date: new Date(Date.now() - 86400000).toISOString(), 
      };

      await expect(
        service.update('test-id', pastEventDto, 'organizer-id', mockFile),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findEventById', () => {
    it('should return an event when found', async () => {
      const mockEvent = {
        id: 'test-id',
        name: 'Test Event',
      };

      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Item: mockEvent,
      });

      const result = await service.findEventById('test-id');
      expect(result).toEqual(mockEvent);
    });

    it('should return null when event is not found', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Item: null,
      });

      const result = await service.findEventById('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('softDelete', () => {
    const mockEvent = {
      id: 'test-id',
      name: 'Test Event',
      organizerId: 'organizer-id',
      status: EventStatus.ACTIVE,
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should soft delete an event successfully', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Item: mockEvent,
      });
      usersService.findUserById.mockResolvedValue({
        id: 'organizer-id',
        name: 'Test Organizer',
        email: 'XXXXXXXXXXXXXXXXXX',
        phone: '1234567890',
        role: UserRole.ORGANIZER,
        password: 'XXXXXXXX',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isEmailValidated: true,
      });

      await service.softDelete('test-id', 'organizer-id');

      expect(dynamoDbService.docClient.send).toHaveBeenCalledTimes(2);
      expect(mailService.sendEventDeletedEmail).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not authorized', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Item: mockEvent,
      });
      usersService.findUserById.mockResolvedValue({
        id: 'different-id',
        name: 'Test Organizer',
        email: 'XXXXXXXXXXXXXXXXXX',
        phone: '1234567890',
        password: 'XXXXXXXX',
        role: UserRole.PARTICIPANT,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isEmailValidated: true,
      });

      await expect(
        service.softDelete('test-id', 'different-id'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
