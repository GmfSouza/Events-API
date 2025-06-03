import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UserRole } from 'src/users/enums/user-role.enum';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('EventsController', () => {
  let controller: EventsController;
  let service: EventsService;

  const mockEventImage = {
    fieldname: 'eventImage',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('test'),
    size: 1024,
  } as Express.Multer.File;

  const mockEvent = {
    id: '1',
    name: 'Test Event',
    description: 'Test Description',
    organizerId: 'org123',
    imageUrl: 'http://example.com/image.jpg',
  };

  const mockEventsService = {
    create: jest.fn(),
    FindAllEvents: jest.fn(),
    findEventById: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        {
          provide: EventsService,
          useValue: mockEventsService,
        },
      ],
    }).compile();

    controller = module.get<EventsController>(EventsController);
    service = module.get<EventsService>(EventsService);
  });

  describe('createEvent', () => {
    const createEventDto: CreateEventDto = {
      name: 'Test Event',
      description: 'Test Description',
      date: new Date().toISOString(),
    };

    it('should create an event when user is an organizer', async () => {
      const req = {
        user: { userId: 'user123', role: UserRole.ORGANIZER },
      };

      mockEventsService.create.mockResolvedValue(mockEvent);

      const result = await controller.createEvent(createEventDto, req as any, mockEventImage);

      expect(service.create).toHaveBeenCalledWith(createEventDto, 'user123', mockEventImage);
      expect(result).toEqual(mockEvent);
    });

    it('should throw ForbiddenException when user is not authorized', async () => {
      const req = {
        user: { userId: 'user123', role: UserRole.PARTICIPANT },
      };

      await expect(
        controller.createEvent(createEventDto, req as any, mockEventImage),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when no image is provided', async () => {
      const req = {
        user: { userId: 'user123', role: UserRole.ORGANIZER },
      };

      await expect(
        controller.createEvent(createEventDto, req as any, undefined as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

   describe('getEvents', () => {
    const listEventsDto = {
      limit: 10,
      lastEvaluatedKey: undefined,
    };

    it('should return list of events', async () => {
      const mockResult = {
        events: [mockEvent],
        total: 1,
        lastEvaluatedKey: undefined,
      };

      mockEventsService.FindAllEvents.mockResolvedValue(mockResult);
      mockEventsService.findEventById.mockResolvedValue(mockEvent);

      const result = await controller.getEvents(listEventsDto);

      expect(service.FindAllEvents).toHaveBeenCalledWith(listEventsDto);
      expect(result.events).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

   describe('getEvent', () => {
    it('should return an event by id', async () => {
      mockEventsService.findEventById.mockResolvedValue(mockEvent);

      const result = await controller.getEvent('1');

      expect(service.findEventById).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockEvent);
    });

    it('should throw NotFoundException when event is not found', async () => {
      mockEventsService.findEventById.mockResolvedValue(null);

      await expect(controller.getEvent('1')).rejects.toThrow(NotFoundException);
    });
  });
});
