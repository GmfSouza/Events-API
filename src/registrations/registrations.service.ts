import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDbService } from 'src/aws/dynamodb/dynamodb.service';
import { EventsService } from 'src/events/events.service';
import { UsersService } from 'src/users/users.service';
import { RegistrationStatus } from './enums/registration-status.enum';
import { Registration } from './interfaces/registration.interface';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { EventStatus } from 'src/events/enums/event-status.enum';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RegistrationsService {
    private readonly logger = new Logger(RegistrationsService.name);
    private readonly regTableName;

    constructor(
        private readonly dynamoDbService: DynamoDbService,
        private readonly configService: ConfigService,
        private readonly eventsService: EventsService,
        private readonly usersService: UsersService,
    ) {
        const tableName = this.configService.get<string>('DYNAMODB_TABLE_REGISTRATIONS');
        if(!tableName) {
            this.logger.error('DYNAMODB_TABLE_REGISTRATIONS is not defined');
            throw new InternalServerErrorException('DYNAMODB_TABLE_REGISTRATIONS is not defined');
        }
        this.regTableName = tableName;
        this.logger.log(`Using registrations table: ${this.regTableName}`);
    }

    private async findExistingRegistration(eventId: string, userId: string): Promise<Registration | null> {
        this.logger.log(`Checking for existing registration for eventId: ${eventId}, userId: ${userId}`);
        const command = new GetCommand({
            TableName: this.regTableName,
            Key: {
                userId: userId,
                eventId: eventId,
            }
        })

        try {
            const response = await this.dynamoDbService.docClient.send(command);
            if(response.Item && response.Item.status === RegistrationStatus.ACTIVE) {
                this.logger.log(`Found existing active registration for userId: ${userId}, eventId: ${eventId}`);
                return response.Item as Registration;
            }

            return null;
        } catch (error) {
            this.logger.error(`Error checking for existing registration: ${error}`);
            throw new InternalServerErrorException('Error checking for existing registration');
        }
    }

    async create(userId: string, createRegistrationDto: CreateRegistrationDto): Promise<Registration> {
        this.logger.log(`Creating registration for userId: ${userId}, eventId: ${createRegistrationDto.eventId}`);
        const { eventId } = createRegistrationDto;

        const user = await this.usersService.findUserById(userId);
        if(!user) {
            this.logger.error(`User not found for userId: ${userId}`);
            throw new NotFoundException('User not found');
        }
        if(!user.isActive) {
            this.logger.error(`User is not active for userId: ${userId}`);
            throw new ForbiddenException('User is not active');
        }

        const event = await this.eventsService.findEventById(eventId);
        if(!event) {
            this.logger.error(`Event not found for eventId: ${eventId}`);
            throw new NotFoundException('Event not found');
        }
        if(event.status !== EventStatus.ACTIVE) {
            this.logger.error(`Event is cancelled for eventId: ${eventId}`);
            throw new BadRequestException('You cannot register for an event that is not active');
        }

        const eventDate = new Date(event.date);
        if(eventDate < new Date()) {
            this.logger.error(`Event date has passed for eventId: ${eventId}`);
            throw new BadRequestException('You cannot register for an event that has already occurred');
        }

        const existingRegistration = await this.findExistingRegistration(eventId, userId);
        if(existingRegistration) {
            this.logger.error(`User already registered for eventId: ${eventId}`);
            throw new ConflictException('You are already registered for this event');
        }

        const registrationId = uuidv4()
        const newRegistration: Registration = {
            id: registrationId,
            userId: userId,
            eventId: eventId,
            registrationDate: new Date().toISOString(),
            status: RegistrationStatus.ACTIVE,
            updatedAt: new Date().toISOString(),
        }

        const command = new PutCommand({
            TableName: this.regTableName,
            Item: newRegistration,
            ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(eventId)',
        })

        try {
            await this.dynamoDbService.docClient.send(command);
            this.logger.log(`Registration created successfully for userId: ${userId}, eventId: ${eventId}`);

            return newRegistration;
        } catch (error) {
            this.logger.error(`Error creating registration: ${error}`);
            throw new InternalServerErrorException('Error creating registration');
        }
    }
}
