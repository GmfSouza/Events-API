import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';
import { EventsService } from '../events/events.service';
import { UsersService } from '../users/users.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { ListUserRegistrationsDto } from './dto/find-registrations-query.dto';
import { AuthenticatedRequest } from '../users/interfaces/auth-request.interface';

describe('RegistrationsController', () => {
  let controller: RegistrationsController;
  let registrationsService: RegistrationsService;
  let eventsService: EventsService;
  let usersService: UsersService;

  const mockRegistrationsService = {
    create: jest.fn(),
    findAllByUserId: jest.fn(),
    cancelRegistration: jest.fn(),
  };

  const mockEventsService = {
    findEventById: jest.fn(),
  };

  const mockUsersService = {
    findUserById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RegistrationsController],
      providers: [
        { provide: RegistrationsService, useValue: mockRegistrationsService },
        { provide: EventsService, useValue: mockEventsService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    controller = module.get<RegistrationsController>(RegistrationsController);
    registrationsService = module.get<RegistrationsService>(RegistrationsService);
    eventsService = module.get<EventsService>(EventsService);
    usersService = module.get<UsersService>(UsersService);
  });

  describe('createRegistration', () => {
    it('should create a registration successfully', async () => {
      const mockRequest = {
        user: { userId: 'user123' },
      } as AuthenticatedRequest;

      const createRegistrationDto: CreateRegistrationDto = {
        eventId: 'event123',
      };

      const mockEvent = {
        id: 'event123',
        organizerId: 'org123',
        title: 'Test Event',
        organizer: {
          id: 'org123',
          name: 'Test Organizer',
        },
      };

      const mockRegistration = {
        id: 'reg123',
        userId: 'user123',
        eventId: 'event123',
        registrationDate: new Date(),
        status: 'CONFIRMED',
        updatedAt: new Date(),
        event: mockEvent
      };

      const mockOrganizer = {
        id: 'org123',
        name: 'Test Organizer',
      };

      mockRegistrationsService.create.mockResolvedValue(mockRegistration);
      mockEventsService.findEventById.mockResolvedValue(mockEvent);
      mockUsersService.findUserById.mockResolvedValue(mockOrganizer);

      const result = await controller.createRegistration(
        mockRequest,
        createRegistrationDto,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(mockRegistration.id);
      expect(result.userId).toBe(mockRegistration.userId);
      expect(result.event).toBeDefined();
      expect(result.event!.organizer).toBeDefined();
      expect(result.event!.organizer!.id).toBe(mockOrganizer.id);
    });
  });

  describe('findRegistrations', () => {
    it('should return user registrations with pagination', async () => {
      const mockRequest = {
        user: { userId: 'user123' },
      } as AuthenticatedRequest;

      const listDto: ListUserRegistrationsDto = {
        limit: 10,
      };

      const mockResponse = {
        registrationsEventDetails: [
          {
            id: 'reg123',
            userId: 'user123',
            eventId: 'event123',
            registrationDate: new Date(),
            status: 'CONFIRMED',
            updatedAt: new Date(),
          },
        ],
        total: 1,
        lastEvaluatedKey: 'lastKey123',
      };

      mockRegistrationsService.findAllByUserId.mockResolvedValue(mockResponse);

      const result = await controller.findRegistrations(mockRequest, listDto);

      expect(result).toBeDefined();
      expect(result.registrationsWithEventDetails).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.lastEvaluatedKey).toBe('lastKey123');
    });
  });

  describe('cancelRegistration', () => {
    it('should cancel registration successfully', async () => {
      const mockRequest = {
        user: { userId: 'user123' },
      } as AuthenticatedRequest;

      const eventId = 'event123';

      mockRegistrationsService.cancelRegistration.mockResolvedValue(undefined);

      await expect(
        controller.cancelRegistration(eventId, mockRequest),
      ).resolves.not.toThrow();

      expect(registrationsService.cancelRegistration).toHaveBeenCalledWith(
        'user123',
        'event123',
      );
    });
  });
});

