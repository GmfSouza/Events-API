import {
  GetCommand,
  PutCommand,
  UpdateCommandInput,
  UpdateCommand,
  QueryCommandInput,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDbService } from 'src/aws/dynamodb/dynamodb.service';
import { EventsService } from 'src/events/events.service';
import { UsersService } from 'src/users/users.service';
import { RegistrationStatus } from './enums/registration-status.enum';
import { Registration } from './interfaces/registration.interface';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { EventStatus } from 'src/events/enums/event-status.enum';
import { v4 as uuidv4 } from 'uuid';
import { ListUserRegistrationsDto } from './dto/find-registrations-query.dto';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class RegistrationsService {
  private readonly logger = new Logger(RegistrationsService.name);
  private readonly regTableName;

  constructor(
    private readonly dynamoDbService: DynamoDbService,
    private readonly configService: ConfigService,
    private readonly eventsService: EventsService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
  ) {
    const tableName = this.configService.get<string>(
      'DYNAMODB_TABLE_REGISTRATIONS',
    );
    if (!tableName) {
      this.logger.error('DYNAMODB_TABLE_REGISTRATIONS is not defined');
      throw new InternalServerErrorException(
        'DYNAMODB_TABLE_REGISTRATIONS is not defined',
      );
    }
    this.regTableName = tableName;
    this.logger.log(`Using registrations table: ${this.regTableName}`);
  }

  private async findExistingRegistration(
    userId: string,
    eventId: string,
  ): Promise<Registration | null> {
    this.logger.log(
      `Checking for existing registration for userId: ${userId}, eventId: ${eventId}`,
    );
    const command = new GetCommand({
      TableName: this.regTableName,
      Key: {
        userId: userId,
        eventId: eventId,
      },
    });

    try {
      const response = await this.dynamoDbService.docClient.send(command);
      if (response.Item) {
        this.logger.log(
          `Found existing active registration for userId: ${userId}, eventId: ${eventId}`,
        );
        return response.Item as Registration;
      }

      this.logger.log(
        `No existing registration found for userId: ${userId}, eventId: ${eventId}`,
      );
      return null;
    } catch (error) {
      this.logger.error(`Error checking for existing registration: ${error}`);
      throw new InternalServerErrorException(
        'Error checking for existing registration',
      );
    }
  }

  async create(
    userId: string,
    createRegistrationDto: CreateRegistrationDto,
  ): Promise<Registration> {
    this.logger.log(
      `Creating registration for userId: ${userId}, eventId: ${createRegistrationDto.eventId}`,
    );
    const { eventId } = createRegistrationDto;

    const user = await this.usersService.findUserById(userId);
    if (!user) {
      this.logger.error(`User not found for userId: ${userId}`);
      throw new NotFoundException('User not found');
    }
    if (!user.isActive) {
      this.logger.error(`User is not active for userId: ${userId}`);
      throw new ForbiddenException('User is not active');
    }

    const event = await this.eventsService.findEventById(eventId);
    if (!event) {
      this.logger.error(`Event not found for eventId: ${eventId}`);
      throw new NotFoundException('Event not found');
    }
    if (event.status !== EventStatus.ACTIVE) {
      this.logger.error(`Event is cancelled for eventId: ${eventId}`);
      throw new BadRequestException(
        'You cannot register for an event that is not active',
      );
    }

    const eventDate = new Date(event.date);
    if (eventDate < new Date()) {
      this.logger.error(`Event date has passed for eventId: ${eventId}`);
      throw new BadRequestException(
        'You cannot register for an event that has already occurred',
      );
    }

    const existingRegistration = await this.findExistingRegistration(
      userId,
      eventId,
    );
    if (existingRegistration) {
      this.logger.error(`User already registered for eventId: ${eventId}`);
      throw new ConflictException('You are already registered for this event');
    }

    const registrationId = uuidv4();
    const newRegistration: Registration = {
      id: registrationId,
      userId: userId,
      eventId: eventId,
      registrationDate: new Date().toISOString(),
      status: RegistrationStatus.ACTIVE,
      updatedAt: new Date().toISOString(),
    };

    const command = new PutCommand({
      TableName: this.regTableName,
      Item: newRegistration,
      ConditionExpression:
        'attribute_not_exists(userId) AND attribute_not_exists(eventId)',
    });

    try {
      await this.dynamoDbService.docClient.send(command);
      this.logger.log(
        `Registration created successfully for userId: ${userId}, eventId: ${eventId}`,
      );

      if (user.email && event) {
        try {
          this.logger.log(
            `Sending registration confirmation email to userId: ${userId}, eventId: ${eventId}`,
          );
          await this.mailService.sendRegistrationNotification(
            user.email,
            user.name,
            event.name,
            event.date,
            event.description,
            event.id,
          );

          this.logger.log(
            `Registration confirmation email sent successfully to userId: ${userId}, eventId: ${eventId}`,
          );
        } catch (emailError) {
          this.logger.error(
            `Error sending registration confirmation email: ${emailError}`,
          );
        }
      }

      return newRegistration;
    } catch (error) {
      this.logger.error(`Error creating registration: ${error}`);
      throw new InternalServerErrorException('Error creating registration');
    }
  }

  async cancelRegistration(
    requestingUserId: string,
    eventId: string,
  ): Promise<void> {
    this.logger.log(
      `Soft deleting registration for userId: ${requestingUserId}, eventId: ${eventId}`,
    );

    const registration = await this.findExistingRegistration(
      requestingUserId,
      eventId,
    );
    if (!registration) {
      this.logger.error(
        `Registration not found for userId: ${requestingUserId}, eventId: ${eventId}`,
      );
      throw new NotFoundException('Registration not found');
    }

    if (registration.status === RegistrationStatus.CANCELLED) {
      this.logger.error(
        `Registration is already cancelled for userId: ${requestingUserId}, eventId: ${eventId}`,
      );
      throw new ConflictException('Registration is already cancelled');
    }

    const event = await this.eventsService.findEventById(eventId);
    if (event) {
      const eventDate = new Date(event.date);
      if (eventDate < new Date()) {
        this.logger.error(`Event date has passed for eventId: ${eventId}`);
        throw new BadRequestException(
          'You cannot cancel a registration for an event that has already occurred',
        );
      }
    }

    const updateCommandInput: UpdateCommandInput = {
      TableName: this.regTableName,
      Key: {
        userId: requestingUserId,
        eventId: eventId,
      },
      UpdateExpression: 'SET #statusAttr = :status, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#statusAttr': 'status',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':status': RegistrationStatus.CANCELLED,
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'NONE',
    };

    try {
      await this.dynamoDbService.docClient.send(
        new UpdateCommand(updateCommandInput),
      );
      this.logger.log(
        `Registration cancelled successfully for userId: ${requestingUserId}, eventId: ${eventId}`,
      );

      const participant =
        await this.usersService.findUserById(requestingUserId);
      if (participant && participant.email && event) {
        try {
          this.logger.log(
            `Sending cancellation confirmation email to userId: ${requestingUserId}, eventId: ${eventId}`,
          );
          await this.mailService.sendRegistrationCancellationNotification(
            participant.email,
            participant.name,
            event.name,
          );

          this.logger.log(
            `Cancellation confirmation email sent successfully to userId: ${requestingUserId}, eventId: ${eventId}`,
          );
        } catch (emailError) {
          this.logger.error(
            `Error sending cancellation confirmation email: ${emailError}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error cancelling registration: ${error}`);
      throw new InternalServerErrorException('Error cancelling registration');
    }
  }

  async findAllByUserId(
    userId: string,
    listDto: ListUserRegistrationsDto,
  ): Promise<{
    registrationsEventDetails: any[];
    total: number;
    lastEvaluatedKey?: string | any;
  }> {
    const { limit = 10, lastEvaluatedKey: exclusiveStartKeyString } = listDto;
    this.logger.debug(`Finding all registrations for userId: ${userId}`);

    let exclusiveStartKey: Record<string, any> | undefined = undefined;
    if (exclusiveStartKeyString) {
      try {
        exclusiveStartKey = JSON.parse(exclusiveStartKeyString);
      } catch (error) {
        this.logger.error(`Error parsing lastEvaluatedKey: ${error}`);
        throw new BadRequestException('Invalid lastEvaluatedKey');
      }
    }

    const queryInput: QueryCommandInput = {
      TableName: this.regTableName,
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: '#status = :activeStatus',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':activeStatus': RegistrationStatus.ACTIVE,
      },
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
      ScanIndexForward: false,
    };

    try {
      const response = await this.dynamoDbService.docClient.send(
        new QueryCommand(queryInput),
      );
      const registrations = (response.Items || []) as Registration[];

      const registrationsEventDetails = await Promise.all(
        registrations.map(async (registration) => {
          const event = await this.eventsService.findEventById(
            registration.eventId,
          );
          let organizerDetails;
          if (event && event.organizerId) {
            const organizer = await this.usersService.findUserById(
              event.organizerId,
            );
            if (organizer) {
              organizerDetails = { id: organizer.id, name: organizer.name };
            }
          }
          return {
            ...registration,
            event: event,
            organizer: organizerDetails,
          };
        }),
      );

      this.logger.log(
        `Found ${registrationsEventDetails.length} registrations for userId: ${userId}`,
      );
      return {
        registrationsEventDetails,
        total: response.Count || 0,
        lastEvaluatedKey: response.LastEvaluatedKey,
      };
    } catch (error) {
      this.logger.error(`Error finding registrations: ${error}`);
      throw new InternalServerErrorException('Error finding registrations');
    }
  }
}
