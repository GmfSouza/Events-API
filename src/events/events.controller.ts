import {
  Body,
  Controller,
  FileTypeValidator,
  ForbiddenException,
  HttpCode,
  Logger,
  MaxFileSizeValidator,
  ParseFilePipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
  Param,
  Get,
  NotFoundException,
  BadRequestException,
  Delete,
  Query,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { AuthenticatedRequest } from 'src/users/interfaces/auth-request.interface';
import { FileInterceptor } from '@nestjs/platform-express';
import { EventResponseDto } from './dto/event-response.dto';
import { UserRole } from 'src/users/enums/user-role.enum';
import { UpdateEventDto } from './dto/update-event.dto';
import { ListEventsDto } from './dto/find-events-query.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EventStatus } from './enums/event-status.enum';

@ApiTags('events')
@Controller('events')
export class EventsController {
  private readonly logger = new Logger(EventsController.name);

  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @HttpCode(201)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('eventImage'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create a new event',
    description:
      'Allows Organizers or Administrators to create a new event. The event image is required.',
  })
  @ApiBody({
    description: 'Event data.',
    schema: {
      type: 'object',
      required: ['name', 'description', 'eventDate'],
      properties: {
        name: { type: 'string', example: 'Technology Conference' },
        description: {
          type: 'string',
          example: 'A conference about technology.',
        },
        eventDate: {
          type: 'string',
          format: 'date-time',
          example: '2026-07-10T19:00:00Z',
        },
        eventImage: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (JPG, JPEG, PNG, WEBP). Max: 5MB.',
          nullable: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Event created successfully.',
    type: EventResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid input data (ex: invalid date, past date, duplicate name).',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied (not Organizer or Admin).',
  })
  @ApiResponse({
    status: 409,
    description: 'An event with this name already exists.',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error.',
  })
  async createEvent(
    @Body() createEventDto: CreateEventDto,
    @Req() request: AuthenticatedRequest,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/i }),
        ],
      }),
    )
    eventImage: Express.Multer.File,
  ): Promise<EventResponseDto> {
    const authUser = request.user;
    this.logger.log('Creating event');
    if (
      authUser.role !== UserRole.ORGANIZER &&
      authUser.role !== UserRole.ADMIN
    ) {
      this.logger.warn(
        `Unauthorized access attempt by user: ${authUser.userId} to create an event`,
      );
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    if (!eventImage) {
      this.logger.warn(`No event image provided by user: ${authUser.userId}`);
      throw new BadRequestException('You must provide an event image');
    }

    const event = await this.eventsService.create(
      createEventDto,
      authUser.userId,
      eventImage,
    );
    this.logger.log(`Event created successfully: ${event.name}`);

    return event;
  }

  @Get()
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'List all events with filters and pagination (Authenticated Users)',
  })
  @ApiQuery({
    name: 'name',
    required: false,
    type: String,
    description: 'Fetch events by name (partial match)',
    example: 'Conference',
  })
  @ApiQuery({
    name: 'dateBefore',
    required: false,
    type: String,
    format: 'date',
    description: 'Fetch events before this date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'dateAfter',
    required: false,
    type: String,
    format: 'date',
    description: 'Fetch events after this date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: EventStatus,
    description: 'Filter by event status',
    example: EventStatus.INACTIVE,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit the number of events returned (per page)',
    schema: { default: 10, minimum: 1, maximum: 50 },
  })
  @ApiQuery({
    name: 'lastEvaluatedKey',
    required: false,
    type: String,
    description: 'JSON string for pagination (last evaluated key)',
    example: '{"id":"123e4567-e89b-12d3-a456-426614174000"}',
  })
  @ApiResponse({
    status: 200,
    description: 'List of events and pagination information.',
    schema: {
      type: 'object',
      properties: {
        events: {
          type: 'array',
          items: { $ref: `#/events/dtos/EventResponseDto` },
        },
        count: { type: 'integer', example: 1 },
        lastEvaluatedKey: {
          type: 'object',
          nullable: true,
          description: 'Last evaluated key for pagination',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters.',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error.',
  })
  async getEvents(@Query() ListEventsDto: ListEventsDto): Promise<{
    events: EventResponseDto[];
    total: number;
    lastEvaluatedKey?: string;
  }> {
    this.logger.log(
      `Fetching events with query: ${JSON.stringify(ListEventsDto)}`,
    );
    const result = await this.eventsService.FindAllEvents(ListEventsDto);

    const eventsResponseDto = await Promise.all(
      result.events.map(async (event) => {
        let organizerInfo: { id: string; name: string } | undefined = undefined;
        if (event.organizerId) {
          const organizer = await this.eventsService.findEventById(
            event.organizerId,
          );
          if (organizer) {
            organizerInfo = {
              id: organizer.id,
              name: organizer.name,
            };
          }
        }
        return new EventResponseDto({
          ...event,
          organizer: organizerInfo,
        });
      }),
    );
    this.logger.log(`Fetched ${eventsResponseDto.length} events`);

    return {
      events: eventsResponseDto,
      total: result.total,
      lastEvaluatedKey: result.lastEvaluatedKey,
    };
  }

  @Get(':id')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch an event by its ID (Authenticated Users)' })
  @ApiParam({
    name: 'id',
    description: 'Event ID (UUID)',
    type: String,
    example: 'event-uuid-example',
  })
  @ApiResponse({
    status: 200,
    description: 'Event found.',
    type: EventResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Event not found.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error.',
  })
  async getEvent(@Param('id') eventId: string): Promise<EventResponseDto> {
    this.logger.log(`Fetching event with ID: ${eventId}`);
    const event = await this.eventsService.findEventById(eventId);
    if (!event) {
      this.logger.warn(`Event not found with ID: ${eventId}`);
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  @Patch(':id')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('eventImage'))
  async updateEvent(
    @Param('id') eventId: string,
    @Body() updateEventDto: UpdateEventDto,
    @Req() request: AuthenticatedRequest,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/i }),
        ],
        fileIsRequired: false,
      }),
    )
    eventImage?: Express.Multer.File,
  ): Promise<EventResponseDto> {
    const authUser = request.user;
    this.logger.log(`Updating event with ID: ${eventId}`);

    if (
      authUser.role !== UserRole.ORGANIZER &&
      authUser.role !== UserRole.ADMIN
    ) {
      this.logger.warn(
        `Unauthorized access attempt by user: ${authUser.userId} to update event ${eventId}`,
      );
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    const updatedEvent = await this.eventsService.update(
      eventId,
      updateEventDto,
      authUser.userId,
      eventImage,
    );
    this.logger.log(`Event with ID ${eventId} updated successfully`);

    return updatedEvent;
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteEvent(
    @Param('id') eventId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    const authUser = request.user;
    this.logger.log(`Deleting event with ID: ${eventId}`);

    await this.eventsService.softDelete(eventId, authUser.userId);
    this.logger.log(`Event with ID ${eventId} deleted successfully`);
  }
}
