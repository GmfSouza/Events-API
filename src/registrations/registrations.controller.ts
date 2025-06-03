import { Body, Controller, HttpCode, Logger, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RegistrationsService } from './registrations.service';
import { EventsService } from 'src/events/events.service';
import { AuthenticatedRequest } from 'src/users/interfaces/auth-request.interface';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { RegistrationResponseDto } from './dto/registration-response.dto';
import { UsersService } from 'src/users/users.service';
import { EventResponseDto } from 'src/events/dto/event-response.dto';

@ApiTags('registrations')
@Controller('registrations')
export class RegistrationsController {
  private readonly logger = new Logger(RegistrationsController.name);

  constructor(
    private readonly registrationsService: RegistrationsService,
    private readonly eventsService: EventsService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  @HttpCode(201)
  async createRegistration(
    @Req() request: AuthenticatedRequest,
    @Body() createRegistrationDto: CreateRegistrationDto,
  ): Promise<RegistrationResponseDto> {
    const authenticatedUser = request.user;
    this.logger.log(
      `User ${authenticatedUser.userId} is attempting to register for event ${createRegistrationDto.eventId}`,
    );

    const registration = await this.registrationsService.create(
      authenticatedUser.userId,
      createRegistrationDto,
    );

    const responseData: Partial<RegistrationResponseDto> = {
      id: registration.id,
      userId: registration.userId,
      eventId: registration.eventId,
      registrationDate: registration.registrationDate,
      status: registration.status,
      updatedAt: registration.updatedAt,
    };

    const eventDetails = await this.eventsService.findEventById(
      registration.eventId,
    );
    if (eventDetails) {
      let organizerDetails: { id: string; name: string } | undefined =
        undefined;
      if (eventDetails.organizerId) {
        const organizer = await this.usersService.findUserById(
          eventDetails.organizerId,
        );
        if (organizer) {
          organizerDetails = { id: organizer.id, name: organizer.name };
        }
      }
      responseData.event = new EventResponseDto({
        ...eventDetails,
        organizer: organizerDetails,
      });
    }

    return new RegistrationResponseDto(responseData);
  }
}
