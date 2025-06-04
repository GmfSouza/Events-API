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
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
});

describe('EventsService', () => {
  let service: EventsService;
  let dynamoDbService: jest.Mocked<DynamoDbService>;
  let s3Service: jest.Mocked<S3Service>;
  let configService: jest.Mocked<ConfigService>;
  let usersService: jest.Mocked<UsersService>;
  let mailService: jest.Mocked<MailService>;

  const mockDynamoDbService = {
    docClient: {
      send: jest.fn(),
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
        S3_EVENT_IMAGE_PATH: 'events-images',
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
        { provide: DynamoDbService, useValue: mockDynamoDbService },
        { provide: S3Service, useValue: mockS3Service },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    dynamoDbService = module.get(DynamoDbService);
    s3Service = module.get(S3Service);
    configService = module.get(ConfigService);
    usersService = module.get(UsersService);
    mailService = module.get(MailService);

    jest.clearAllMocks();
  });

  describe('findEventById', () => {
    it('should return event when found', async () => {
      const event = { id: '1', name: 'Test' };
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Item: event,
      });
      const result = await service.findEventById('1');
      expect(result).toEqual(event);
    });

    it('should return null when not found', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({});
      const result = await service.findEventById('not-found');
      expect(result).toBeNull();
    });

    it('should throw InternalServerErrorException on error', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockRejectedValueOnce(
        new Error('fail'),
      );
      await expect(service.findEventById('1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('create', () => {
    const mockOrganizer = {
      id: 'org-id',
      name: 'Org',
      email: 'org@test.com',
      role: UserRole.ORGANIZER,
      isActive: true,
      phone: '123456789',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEmailValidated: true,
    };
    const mockFile = {
      buffer: Buffer.from('test'),
      originalname: 'img.jpg',
      mimetype: 'image/jpeg',
    } as Express.Multer.File;
    const dto = {
      name: 'Event',
      description: 'Desc',
      date: new Date(Date.now() + 86400000).toISOString(),
    };

    beforeEach(() => {
      usersService.findUserById.mockResolvedValue(mockOrganizer as any);
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValue({});
      s3Service.uploadFile.mockResolvedValue({
        Location: 'url',
        Key: 'key',
        Bucket: 'bucket',
      });
      (mailService.sendCreatedEventEmail as jest.Mock).mockResolvedValue(
        undefined,
      );
    });

    it('should create event successfully', async () => {
      const result = await service.create(dto, mockOrganizer.id, mockFile);
      expect(result).toBeDefined();
      expect(result.name).toBe(dto.name);
      expect(result.organizer).toEqual({
        id: mockOrganizer.id,
        name: mockOrganizer.name,
      });
      expect(dynamoDbService.docClient.send).toHaveBeenCalled();
      expect(mailService.sendCreatedEventEmail).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if not organizer or admin', async () => {
      usersService.findUserById.mockResolvedValue({
        ...mockOrganizer,
        role: UserRole.PARTICIPANT,
      });
      await expect(
        service.create(dto, mockOrganizer.id, mockFile),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if not active', async () => {
      usersService.findUserById.mockResolvedValue({
        ...mockOrganizer,
        isActive: false,
      });
      await expect(
        service.create(dto, mockOrganizer.id, mockFile),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if event name exists', async () => {
      jest.spyOn(service as any, 'eventNameExists').mockResolvedValueOnce(true);
      await expect(
        service.create(dto, mockOrganizer.id, mockFile),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if date is in the past', async () => {
      const pastDto = {
        ...dto,
        date: new Date(Date.now() - 86400000).toISOString(),
      };
      await expect(
        service.create(pastDto, mockOrganizer.id, mockFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException if organizer not found', async () => {
      usersService.findUserById.mockResolvedValue(null);
      await expect(
        service.create(dto, mockOrganizer.id, mockFile),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('update', () => {
    const mockEvent = {
      id: '1',
      name: 'Event',
      description: 'Desc',
      date: new Date(Date.now() + 86400000).toISOString(),
      organizerId: 'org-id',
      status: EventStatus.ACTIVE,
      imageUrl: 'url',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const mockRequester = {
      id: 'org-id',
      name: 'Org',
      role: UserRole.ORGANIZER,
      isActive: true,
      email: 'org@test.com',
      phone: '123456789',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEmailValidated: true,
    };
    const dto = {
      name: 'New Name',
      description: 'New Desc',
      date: new Date(Date.now() + 86400000).toISOString(),
    };
    const mockFile = {
      buffer: Buffer.from('test'),
      originalname: 'img.jpg',
      mimetype: 'image/jpeg',
    } as Express.Multer.File;

    beforeEach(() => {
      jest.clearAllMocks();
      usersService.findUserById.mockResolvedValue(mockRequester as any);
      s3Service.uploadFile.mockResolvedValue({
        Location: 'url',
        Key: 'key',
        Bucket: 'bucket',
      });
    });

    it('should update event successfully', async () => {
      const updatedEvent = {
        id: '1',
        name: 'New Name',
        description: 'New Desc',
        date: dto.date,
        organizerId: mockRequester.id,
        status: EventStatus.ACTIVE,
        imageUrl: 'url',
        createdAt: mockEvent.createdAt,
        updatedAt: new Date().toISOString(),
      };

      jest.spyOn(service, 'findEventById').mockResolvedValue(mockEvent);

      (dynamoDbService.docClient.send as jest.Mock)
        .mockResolvedValueOnce({ Item: mockEvent }) 
        .mockResolvedValueOnce({ Attributes: updatedEvent }); 

      const result = await service.update('1', dto, mockRequester.id, mockFile);
      console.log('result', result);
      expect(result).toBeDefined();
      expect(result.name).toBe(dto.name);
      expect(result.organizer).toEqual({
        id: mockRequester.id,
        name: mockRequester.name,
      });
    });

    it('should throw NotFoundException if event not found', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Item: null,
      });
      await expect(
        service.update('not-found', dto, mockRequester.id, mockFile),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if requester not found', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Item: mockEvent,
      });
      usersService.findUserById.mockResolvedValue(null);
      await expect(
        service.update('1', dto, mockRequester.id, mockFile),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if requester not active', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Item: mockEvent,
      });
      usersService.findUserById.mockResolvedValue({
        ...mockRequester,
        isActive: false,
      });
      await expect(
        service.update('1', dto, mockRequester.id, mockFile),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if not owner or admin', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Item: mockEvent,
      });
      usersService.findUserById.mockResolvedValue({
        ...mockRequester,
        id: 'other',
        role: UserRole.PARTICIPANT,
      });
      await expect(service.update('1', dto, 'other', mockFile)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if date is in the past', async () => {
      const pastDto = {
        ...dto,
        date: new Date(Date.now() - 86400000).toISOString(),
      };
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Item: mockEvent,
      });
      await expect(
        service.update('1', pastDto, mockRequester.id, mockFile),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('softDelete', () => {
    jest.clearAllMocks();

    const mockEvent = {
      id: '1',
      name: 'Event',
      organizerId: 'org-id',
      status: EventStatus.ACTIVE,
    };
    const mockOrganizer = {
      id: 'org-id',
      name: 'Org',
      role: UserRole.ORGANIZER,
      isActive: true,
      email: 'org@test.com',
      phone: '123456789',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEmailValidated: true,
    };

    beforeEach(() => {
      usersService.findUserById.mockResolvedValue(mockOrganizer as any);
    });

    it('should soft delete event successfully', async () => {
      jest.clearAllMocks();
      (dynamoDbService.docClient.send as jest.Mock)
        .mockResolvedValueOnce({ Item: mockEvent }) 
        .mockResolvedValueOnce({});
      await service.softDelete('1', mockOrganizer.id);
      expect(dynamoDbService.docClient.send).toHaveBeenCalledTimes(2);
      expect(mailService.sendEventDeletedEmail).toHaveBeenCalled();
    });

    it('should throw NotFoundException if event not found', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Item: null,
      }); 
      await expect(
        service.softDelete('not-found', mockOrganizer.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if event already inactive', async () => {
      (dynamoDbService.docClient.send as jest.Mock)
        .mockResolvedValueOnce({
          Item: { ...mockEvent, status: EventStatus.INACTIVE },
        })
        .mockResolvedValueOnce({});
      await expect(service.softDelete('1', mockOrganizer.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if requester not found', async () => {
      usersService.findUserById.mockResolvedValue(null);
      await expect(service.softDelete('1', mockOrganizer.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if requester not active', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Item: mockEvent,
      });
      usersService.findUserById.mockResolvedValue({
        ...mockOrganizer,
        isActive: false,
      });
      await expect(service.softDelete('1', mockOrganizer.id)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if not owner or admin', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Item: mockEvent,
      }); 
      usersService.findUserById.mockResolvedValue({
        ...mockOrganizer,
        id: 'other',
        role: UserRole.PARTICIPANT,
      });
      await expect(service.softDelete('1', 'other')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('eventNameExists', () => {
    it('should return true if event name exists', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Items: [{ id: '1', name: 'Test Event' }],
      });
      const result = await (service as any).eventNameExists('Test Event');
      expect(result).toBe(true);
    });

    it('should return false if event name does not exist', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Items: [],
      });
      const result = await (service as any).eventNameExists('Nonexistent');
      expect(result).toBe(false);
    });

    it('should throw InternalServerErrorException on error', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockRejectedValueOnce(
        new Error('fail'),
      );
      await expect(
        (service as any).eventNameExists('Test Event'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('FindAllEvents', () => {
    it('should return events and total count (Scan)', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Items: [
          { id: '1', name: 'Event 1', status: EventStatus.ACTIVE },
          { id: '2', name: 'Event 2', status: EventStatus.ACTIVE },
        ],
        Count: 2,
        LastEvaluatedKey: undefined,
      });
      const result = await service.FindAllEvents({});
      expect(result.events.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.lastEvaluatedKey).toBeUndefined();
    });

    it('should return empty array and zero total if no events (Scan)', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Items: [],
        Count: 0,
        LastEvaluatedKey: undefined,
      });
      const result = await service.FindAllEvents({});
      expect(result.events).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.lastEvaluatedKey).toBeUndefined();
    });

    it('should return paginated results (Scan)', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Items: [{ id: '1', name: 'Event 1', status: EventStatus.ACTIVE }],
        Count: 1,
        LastEvaluatedKey: { id: '1' },
      });
      const result = await service.FindAllEvents({ limit: 1 });
      expect(result.events.length).toBe(1);
      expect(result.lastEvaluatedKey).toEqual({ id: '1' });
    });

    it('should filter by status (Query)', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Items: [{ id: '1', name: 'Event 1', status: EventStatus.INACTIVE }],
        Count: 1,
        LastEvaluatedKey: undefined,
      });
      const result = await service.FindAllEvents({
        status: EventStatus.INACTIVE,
      });
      expect(result.events[0].status).toBe(EventStatus.INACTIVE);
    });

    it('should filter by status and dateAfter (Query)', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Items: [
          {
            id: '1',
            name: 'Event 1',
            status: EventStatus.ACTIVE,
            date: new Date(Date.now() + 86400000).toISOString(),
          },
        ],
        Count: 1,
        LastEvaluatedKey: undefined,
      });
      const result = await service.FindAllEvents({
        status: EventStatus.ACTIVE,
        dateAfter: new Date(Date.now() - 86400000).toISOString(),
      });
      expect(result.events[0].status).toBe(EventStatus.ACTIVE);
    });

    it('should filter by status and dateBefore (Query)', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Items: [
          {
            id: '1',
            name: 'Event 1',
            status: EventStatus.ACTIVE,
            date: new Date(Date.now() - 86400000).toISOString(),
          },
        ],
        Count: 1,
        LastEvaluatedKey: undefined,
      });
      const result = await service.FindAllEvents({
        status: EventStatus.ACTIVE,
        dateBefore: new Date(Date.now() + 86400000).toISOString(),
      });
      expect(result.events[0].status).toBe(EventStatus.ACTIVE);
    });

    it('should filter by status, dateAfter and dateBefore (Query)', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Items: [
          {
            id: '1',
            name: 'Event 1',
            status: EventStatus.ACTIVE,
            date: new Date().toISOString(),
          },
        ],
        Count: 1,
        LastEvaluatedKey: undefined,
      });
      const result = await service.FindAllEvents({
        status: EventStatus.ACTIVE,
        dateAfter: new Date(Date.now() - 86400000).toISOString(),
        dateBefore: new Date(Date.now() + 86400000).toISOString(),
      });
      expect(result.events[0].status).toBe(EventStatus.ACTIVE);
    });

    it('should filter by name (Scan)', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Items: [{ id: '1', name: 'Special Event', status: EventStatus.ACTIVE }],
        Count: 1,
        LastEvaluatedKey: undefined,
      });
      const result = await service.FindAllEvents({
        name: 'Special',
      });
      expect(result.events[0].name).toContain('Special');
    });

    it('should filter by name and status (Query)', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
        Items: [{ id: '1', name: 'Special Event', status: EventStatus.ACTIVE }],
        Count: 1,
        LastEvaluatedKey: undefined,
      });
      const result = await service.FindAllEvents({
        name: 'Special',
        status: EventStatus.ACTIVE,
      });
      expect(result.events[0].name).toContain('Special');
      expect(result.events[0].status).toBe(EventStatus.ACTIVE);
    });

    it('should throw BadRequestException if lastEvaluatedKey is invalid', async () => {
      await expect(
        service.FindAllEvents({ lastEvaluatedKey: 'invalid-json' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on error', async () => {
      (dynamoDbService.docClient.send as jest.Mock).mockRejectedValueOnce(
        new Error('fail'),
      );
      await expect(service.FindAllEvents({})).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
  it('should filter by name and dateAfter (Scan)', async () => {
    (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
      Items: [
        {
          id: '1',
          name: 'Special Event',
          date: new Date(Date.now() + 86400000).toISOString(),
        },
      ],
      Count: 1,
      LastEvaluatedKey: undefined,
    });
    const result = await service.FindAllEvents({
      name: 'Special',
      dateAfter: new Date(Date.now() - 86400000).toISOString(),
    });
    expect(result.events[0].name).toContain('Special');
  });

  it('should filter by name and dateBefore (Scan)', async () => {
    (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
      Items: [
        {
          id: '1',
          name: 'Special Event',
          date: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
      Count: 1,
      LastEvaluatedKey: undefined,
    });
    const result = await service.FindAllEvents({
      name: 'Special',
      dateBefore: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(result.events[0].name).toContain('Special');
  });

  it('should filter by dateAfter only (Scan)', async () => {
    (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
      Items: [
        {
          id: '1',
          name: 'Event',
          date: new Date(Date.now() + 86400000).toISOString(),
        },
      ],
      Count: 1,
      LastEvaluatedKey: undefined,
    });
    const result = await service.FindAllEvents({
      dateAfter: new Date(Date.now() - 86400000).toISOString(),
    });
    expect(result.events[0].date).toBeDefined();
  });

  it('should filter by dateBefore only (Scan)', async () => {
    (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
      Items: [
        {
          id: '1',
          name: 'Event',
          date: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
      Count: 1,
      LastEvaluatedKey: undefined,
    });
    const result = await service.FindAllEvents({
      dateBefore: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(result.events[0].date).toBeDefined();
  });

  it('should filter by all filters together (Query)', async () => {
    (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
      Items: [
        {
          id: '1',
          name: 'Special Event',
          status: EventStatus.ACTIVE,
          date: new Date().toISOString(),
        },
      ],
      Count: 1,
      LastEvaluatedKey: undefined,
    });
    const result = await service.FindAllEvents({
      name: 'Special',
      status: EventStatus.ACTIVE,
      dateAfter: new Date(Date.now() - 86400000).toISOString(),
      dateBefore: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(result.events[0].name).toContain('Special');
    expect(result.events[0].status).toBe(EventStatus.ACTIVE);
  });

  it('should handle valid lastEvaluatedKey', async () => {
    (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
      Items: [{ id: '1', name: 'Event 1', status: EventStatus.ACTIVE }],
      Count: 1,
      LastEvaluatedKey: { id: '1' },
    });
    const result = await service.FindAllEvents({
      lastEvaluatedKey: JSON.stringify({ id: '1' }),
    });
    expect(result.lastEvaluatedKey).toEqual({ id: '1' });
  });

  it('should filter by status only (Query)', async () => {
    (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
      Items: [{ id: '1', name: 'Event 1', status: EventStatus.ACTIVE }],
      Count: 1,
      LastEvaluatedKey: undefined,
    });
    const result = await service.FindAllEvents({
      status: EventStatus.ACTIVE,
    });
    expect(result.events[0].status).toBe(EventStatus.ACTIVE);
  });

  it('should filter by name only (Scan)', async () => {
    (dynamoDbService.docClient.send as jest.Mock).mockResolvedValueOnce({
      Items: [{ id: '1', name: 'Special Event' }],
      Count: 1,
      LastEvaluatedKey: undefined,
    });
    const result = await service.FindAllEvents({
      name: 'Special',
    });
    expect(result.events[0].name).toContain('Special');
  });
});
