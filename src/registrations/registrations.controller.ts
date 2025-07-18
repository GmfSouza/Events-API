import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegistrationsService } from './registrations.service';
import { EventsService } from 'src/events/events.service';
import { AuthenticatedRequest } from 'src/users/interfaces/auth-request.interface';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { RegistrationResponseDto } from './dto/registration-response.dto';
import { UsersService } from 'src/users/users.service';
import { EventResponseDto } from 'src/events/dto/event-response.dto';
import { ListUserRegistrationsDto } from './dto/find-registrations-query.dto';

@ApiBearerAuth('jwt-token')
@ApiTags('registrations')
@Controller('registrations')
export class RegistrationsController {
  constructor(
    private readonly registrationsService: RegistrationsService,
    private readonly eventsService: EventsService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  @HttpCode(201)
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
  @ApiOperation({ summary: 'List all authenticated user registrations' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'NNumber of items per page', schema: { default: 10, minimum: 1, maximum: 50 } })
  @ApiQuery({ name: 'lastEvaluatedKey', required: false, type: String, description: 'Key to continue pagination (JSON stringified)' })
  @ApiResponse({ status: 200, description: 'List of user registrations returned.', schema: {
      type: 'object',
      properties: {
          registrationsWithEventDetails: { type: 'array', items: { $ref: `#/components/schemas/RegistrationResponseDto` } },
          count: { type: 'integer', example: 1 },
          lastEvaluatedKey: { type: 'object', nullable: true, description: 'Key for the next page.' }
      }
  }})
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async findRegistrations(
    @Req() request: AuthenticatedRequest,
    @Query() listDto: ListUserRegistrationsDto,
  ): Promise<{
    registrationsWithEventDetails: RegistrationResponseDto[];
    total: number;
    lastEvaluatedKey?: string | any;
  }> {
    const authenticatedUser = request.user;

    const response = await this.registrationsService.findAllByUserId(
      authenticatedUser.userId,
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
  @ApiOperation({ summary: 'Inactivate a user registration for an event' })
  @ApiParam({ name: 'eventId', description: 'ID of the event for which the registration will be canceled', type: String, format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Registration successfully canceled.' })
  @ApiResponse({ status: 404, description: 'Registration not found.' })
  @ApiResponse({ status: 400, description: 'Registration already canceled or event has already occurred.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async cancelRegistration(
    @Param('eventId') eventId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    const authenticatedUser = request.user;

    await this.registrationsService.cancelRegistration(
      authenticatedUser.userId,
      eventId,
    );
  }
}
