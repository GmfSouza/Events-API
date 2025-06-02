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
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { AuthenticatedRequest } from 'src/users/interfaces/auth-request.interface';
import { FileInterceptor } from '@nestjs/platform-express';
import { EventResponseDto } from './dto/event-response.dto';
import { UserRole } from 'src/users/enums/user-role.enum';
import { UpdateEventDto } from './dto/update-event.dto';

@Controller('events')
export class EventsController {
  private readonly logger = new Logger(EventsController.name);

  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('eventImage'))
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

  @Get(':id')
  @HttpCode(200)
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
}
