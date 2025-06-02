import {
    Body,
  Controller,
  FileTypeValidator,
  ForbiddenException,
  HttpCode,
  Logger,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { AuthenticatedRequest } from 'src/users/interfaces/auth-request.interface';
import { FileInterceptor } from '@nestjs/platform-express';
import { EventResponseDto } from './dto/event-response.dto';
import { UserRole } from 'src/users/enums/user-role.enum';

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
                new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/i })
            ]
        })
    ) 
    eventImage: Express.Multer.File
  ): Promise<EventResponseDto> {
    const authUser = request.user;
    this.logger.log('Creating event');
    if (authUser.role !== UserRole.ORGANIZER && authUser.role !== UserRole.ADMIN) {
      this.logger.warn(`Unauthorized access attempt by user: ${authUser.userId} to create an event`);
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    if (!eventImage) {
      this.logger.warn(`No event image provided by user: ${authUser.userId}`);
      throw new ForbiddenException('You must provide an event image');
    }

    const event = await this.eventsService.create(createEventDto, authUser.userId, eventImage);
    this.logger.log(`Event created successfully: ${event.name}`);

    return new EventResponseDto(event);
  }
}
