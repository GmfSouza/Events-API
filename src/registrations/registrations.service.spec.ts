import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationsService } from './registrations.service';
import { DynamoDbService } from 'src/aws/dynamodb/dynamodb.service';
import { ConfigService } from '@nestjs/config';
import { EventsService } from 'src/events/events.service';
import { UsersService } from 'src/users/users.service';
import { MailService } from 'src/mail/mail.service';
import { RegistrationStatus } from './enums/registration-status.enum';
import { EventStatus } from 'src/events/enums/event-status.enum';
import { InternalServerErrorException, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { Registration } from './interfaces/registration.interface';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { ListUserRegistrationsDto } from './dto/find-registrations-query.dto';

describe('RegistrationsService', () => {
  let service: RegistrationsService;
  let dynamoDbService: any;
  let configService: any;
  let eventsService: any;
  let usersService: any;
  let mailService: any;

  const mockDynamoDbService = {
    docClient: {
      send: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-table-name'),
  };

  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'user@test.com',
    isActive: true,
    phone: '1234567890',
    role: 'USER',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isEmailValidated: true,
  };

  const mockEvent = {
    id: 'event-1',
    name: 'Test Event',
    date: new Date(Date.now() + 86400000).toISOString(),
    status: EventStatus.ACTIVE,
    description: 'Event description',
    imageUrl: 'https://example.com/image.jpg',
    organizerId: 'org-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockOrganizer = {
    id: 'org-1',
    name: 'Organizer Name',
    email: 'org@test.com',
    isActive: true,
    phone: '1234567890',
    role: 'ORGANIZER',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isEmailValidated: true,
  };

  const mockRegistration: Registration = {
    id: 'reg-1',
    userId: mockUser.id,
    eventId: mockEvent.id,
    registrationDate: new Date().toISOString(),
    status: RegistrationStatus.ACTIVE,
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    eventsService = { findEventById: jest.fn() };
    usersService = { findUserById: jest.fn() };
    mailService = {
      sendRegistrationNotification: jest.fn(),
      sendRegistrationCancellationNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationsService,
        { provide: DynamoDbService, useValue: mockDynamoDbService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EventsService, useValue: eventsService },
        { provide: UsersService, useValue: usersService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<RegistrationsService>(RegistrationsService);
    dynamoDbService = module.get<DynamoDbService>(DynamoDbService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  describe('findExistingRegistration', () => {
    it('should return registration if found', async () => {
      mockDynamoDbService.docClient.send.mockResolvedValueOnce({ Item: mockRegistration });
      const result = await (service as any).findExistingRegistration(mockUser.id, mockEvent.id);
      expect(result).toEqual(mockRegistration);
    });

    it('should return null if not found', async () => {
      mockDynamoDbService.docClient.send.mockResolvedValueOnce({ Item: null });
      const result = await (service as any).findExistingRegistration(mockUser.id, mockEvent.id);
      expect(result).toBeNull();
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockDynamoDbService.docClient.send.mockRejectedValueOnce(new Error('fail'));
      await expect((service as any).findExistingRegistration(mockUser.id, mockEvent.id))
        .rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('create', () => {
    it('should create a registration successfully', async () => {
      usersService.findUserById.mockResolvedValue(mockUser);
      eventsService.findEventById.mockResolvedValue(mockEvent);
      jest.spyOn(service as any, 'findExistingRegistration').mockResolvedValue(null);
      mockDynamoDbService.docClient.send.mockResolvedValue({});
      mailService.sendRegistrationNotification.mockResolvedValue(undefined);

      const dto: CreateRegistrationDto = { eventId: mockEvent.id };
      const result = await service.create(mockUser.id, dto);

      expect(result).toHaveProperty('id');
      expect(result.userId).toBe(mockUser.id);
      expect(result.eventId).toBe(mockEvent.id);
      expect(result.status).toBe(RegistrationStatus.ACTIVE);
      expect(usersService.findUserById).toHaveBeenCalledWith(mockUser.id);
      expect(eventsService.findEventById).toHaveBeenCalledWith(mockEvent.id);
      expect(mockDynamoDbService.docClient.send).toHaveBeenCalled();
      expect(mailService.sendRegistrationNotification).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      usersService.findUserById.mockResolvedValue(null);
      const dto: CreateRegistrationDto = { eventId: mockEvent.id };
      await expect(service.create(mockUser.id, dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not active', async () => {
      usersService.findUserById.mockResolvedValue({ ...mockUser, isActive: false });
      const dto: CreateRegistrationDto = { eventId: mockEvent.id };
      await expect(service.create(mockUser.id, dto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if event not found', async () => {
      usersService.findUserById.mockResolvedValue(mockUser);
      eventsService.findEventById.mockResolvedValue(null);
      const dto: CreateRegistrationDto = { eventId: mockEvent.id };
      await expect(service.create(mockUser.id, dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if event is not active', async () => {
      usersService.findUserById.mockResolvedValue(mockUser);
      eventsService.findEventById.mockResolvedValue({ ...mockEvent, status: EventStatus.INACTIVE });
      const dto: CreateRegistrationDto = { eventId: mockEvent.id };
      await expect(service.create(mockUser.id, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if event date is in the past', async () => {
      usersService.findUserById.mockResolvedValue(mockUser);
      eventsService.findEventById.mockResolvedValue({ ...mockEvent, date: new Date(Date.now() - 86400000).toISOString() });
      const dto: CreateRegistrationDto = { eventId: mockEvent.id };
      await expect(service.create(mockUser.id, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if already registered', async () => {
      usersService.findUserById.mockResolvedValue(mockUser);
      eventsService.findEventById.mockResolvedValue(mockEvent);
      jest.spyOn(service as any, 'findExistingRegistration').mockResolvedValue(mockRegistration);
      const dto: CreateRegistrationDto = { eventId: mockEvent.id };
      await expect(service.create(mockUser.id, dto)).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException on DynamoDB error', async () => {
      usersService.findUserById.mockResolvedValue(mockUser);
      eventsService.findEventById.mockResolvedValue(mockEvent);
      jest.spyOn(service as any, 'findExistingRegistration').mockResolvedValue(null);
      mockDynamoDbService.docClient.send.mockRejectedValueOnce(new Error('fail'));
      const dto: CreateRegistrationDto = { eventId: mockEvent.id };
      await expect(service.create(mockUser.id, dto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('cancelRegistration', () => {
    it('should cancel a registration successfully', async () => {
      jest.spyOn(service as any, 'findExistingRegistration').mockResolvedValue(mockRegistration);
      eventsService.findEventById.mockResolvedValue(mockEvent);
      usersService.findUserById.mockResolvedValue(mockUser);
      mockDynamoDbService.docClient.send.mockResolvedValue({});
      mailService.sendRegistrationCancellationNotification.mockResolvedValue(undefined);

      await expect(service.cancelRegistration(mockUser.id, mockEvent.id)).resolves.toBeUndefined();
      expect(mockDynamoDbService.docClient.send).toHaveBeenCalled();
      expect(usersService.findUserById).toHaveBeenCalledWith(mockUser.id);
      expect(eventsService.findEventById).toHaveBeenCalledWith(mockEvent.id);
      expect(mailService.sendRegistrationCancellationNotification).toHaveBeenCalled();
    });

    it('should throw NotFoundException if registration not found', async () => {
      jest.spyOn(service as any, 'findExistingRegistration').mockResolvedValue(null);
      await expect(service.cancelRegistration(mockUser.id, mockEvent.id)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if registration already cancelled', async () => {
      jest.spyOn(service as any, 'findExistingRegistration').mockResolvedValue({ ...mockRegistration, status: RegistrationStatus.CANCELLED });
      await expect(service.cancelRegistration(mockUser.id, mockEvent.id)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if event already occurred', async () => {
      jest.spyOn(service as any, 'findExistingRegistration').mockResolvedValue(mockRegistration);
      eventsService.findEventById.mockResolvedValue({ ...mockEvent, date: new Date(Date.now() - 86400000).toISOString() });
      await expect(service.cancelRegistration(mockUser.id, mockEvent.id)).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on DynamoDB error', async () => {
      jest.spyOn(service as any, 'findExistingRegistration').mockResolvedValue(mockRegistration);
      eventsService.findEventById.mockResolvedValue(mockEvent);
      usersService.findUserById.mockResolvedValue(mockUser);
      mockDynamoDbService.docClient.send.mockRejectedValueOnce(new Error('fail'));
      await expect(service.cancelRegistration(mockUser.id, mockEvent.id)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findAllByUserId', () => {
    it('should return user registrations with event and organizer details', async () => {
      mockDynamoDbService.docClient.send.mockResolvedValueOnce({
        Items: [mockRegistration],
        Count: 1,
        LastEvaluatedKey: undefined,
      });
      eventsService.findEventById.mockResolvedValue(mockEvent);
      usersService.findUserById.mockResolvedValue(mockOrganizer);

      const listDto: ListUserRegistrationsDto = { limit: 10 };
      const result = await service.findAllByUserId(mockUser.id, listDto);

      expect(result.registrationsEventDetails).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.lastEvaluatedKey).toBeUndefined();

      const regDetail = result.registrationsEventDetails[0];
      expect(regDetail).toMatchObject({
        ...mockRegistration,
        event: mockEvent,
        organizer: { id: mockOrganizer.id, name: mockOrganizer.name },
      });

      expect(eventsService.findEventById).toHaveBeenCalledWith(mockEvent.id);
      expect(usersService.findUserById).toHaveBeenCalledWith(mockEvent.organizerId);
      expect(mockDynamoDbService.docClient.send).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid lastEvaluatedKey', async () => {
      const listDto: ListUserRegistrationsDto = { limit: 10, lastEvaluatedKey: 'invalid-json' };
      await expect(service.findAllByUserId(mockUser.id, listDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on DynamoDB error', async () => {
      mockDynamoDbService.docClient.send.mockRejectedValueOnce(new Error('fail'));
      const listDto: ListUserRegistrationsDto = { limit: 10 };
      await expect(service.findAllByUserId(mockUser.id, listDto)).rejects.toThrow(InternalServerErrorException);
    });
  });
});