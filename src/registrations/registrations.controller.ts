import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegistrationsService } from './registrations.service';
import { EventsService } from 'src/events/events.service';
import { AuthenticatedRequest } from 'src/users/interfaces/auth-request.interface';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { RegistrationResponseDto } from './dto/registration-response.dto';
import { UsersService } from 'src/users/users.service';
import { EventResponseDto } from 'src/events/dto/event-response.dto';
import { ListUserRegistrationsDto } from './dto/find-registrations-query.dto';

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
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a registration',
    description: 'Allows an authenticated user (Participant, Organizer, or Admin) to register for an event. The user ID is obtained from the JWT token.',
  })
  @ApiBody({ type: CreateRegistrationDto })
  @ApiResponse({ status: 201, description: 'Registration successful.', type: RegistrationResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data (ex: event has passed, event is inactive).' })
  @ApiResponse({ status: 404, description: 'Event or Participant not found.' })
  @ApiResponse({ status: 403, description: 'Access denied (ex: user account is inactive).' })
  @ApiResponse({ status: 409, description: 'User is already registered for this event.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
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

  @Get()
  @HttpCode(200)
  async findRegistrations(
    @Req() request: AuthenticatedRequest,
    @Query() listDto: ListUserRegistrationsDto,
  ): Promise<{
    registrationsWithEventDetails: RegistrationResponseDto[];
    total: number;
    lastEvaluatedKey?: string | any;
  }> {
    const authhenticatedUser = request.user;
    this.logger.log(
      `User ${authhenticatedUser.userId} is retrieving their registrations`,
    );

    const response = await this.registrationsService.findAllByUserId(
      authhenticatedUser.userId,
      listDto,
    );

    const responseItems = response.registrationsEventDetails.map(
        item => new RegistrationResponseDto(item),
    )

    return {
        registrationsWithEventDetails: responseItems,
        total: response.total,
        lastEvaluatedKey: response.lastEvaluatedKey,
    }
  }

  @Delete(':eventId')
  @HttpCode(204)
  async cancelRegistration(
    @Param('eventId') eventId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    const authenticatedUser = request.user;
    this.logger.log(
      `User ${authenticatedUser.userId} is attempting to cancel registration for event ${eventId}`,
    );

    await this.registrationsService.cancelRegistration(
      authenticatedUser.userId,
      eventId,
    );
  }
}
