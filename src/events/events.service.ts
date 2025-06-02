import { PutCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDbService } from 'src/aws/dynamodb/dynamodb.service';
import { S3Service } from 'src/aws/s3/s3.service';
import { UsersService } from 'src/users/users.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { UserRole } from 'src/users/enums/user-role.enum';
import { v4 as uuidv4 } from 'uuid';
import { Event } from './interfaces/event.interface';
import { EventStatus } from './enums/event-status.enum';

@Injectable()
export class EventsService {
    private readonly logger = new Logger(EventsService.name);
    private readonly eventsTable: string;
    private readonly eventNameIndex: string = 'name-index';
    
    constructor(
        private readonly dynamoDBService: DynamoDbService,
        private readonly s3Service: S3Service,
        private readonly configService: ConfigService,
        private readonly usersService: UsersService,
    ) {
        const tableName = this.configService.get<string>('DYNAMODB_TABLE_EVENTS');
        if (!tableName) {
            throw new InternalServerErrorException('DYNAMODB_TABLE_EVENTS not defined in environment variables');
        }
        this.eventsTable = tableName;
        this.logger.log(`Using DynamoDB table: ${this.eventsTable}`);
    }

    private async eventNameExists(name: string): Promise<boolean> {
        this.logger.log(`Checking if event name exists: ${name}`);
        const command = new QueryCommand({
            TableName: this.eventsTable,
            IndexName: this.eventNameIndex,
            KeyConditionExpression: '#eventName = :name',
            ExpressionAttributeNames: {
                '#eventName': 'name',
            },
            ExpressionAttributeValues: {
                ':name': name,
            },
            Limit: 1,
        });

        try {
            const response = await this.dynamoDBService.docClient.send(command);
            return !!response.Items && response.Items.length > 0;
        } catch (error) {
            this.logger.error(`Error checking if event name exists: ${name}`, error.stack);
            throw new InternalServerErrorException('Error checking if event name exists');
        }
    }

    async findEventById(eventId: string): Promise<Event | null> {
        this.logger.log(`Finding event by ID: ${eventId}`);
        const command = new GetCommand({
            TableName: this.eventsTable,
            Key: { id: eventId },
        });

        try {
            const response = await this.dynamoDBService.docClient.send(command);
            if (response.Item) {
                this.logger.log(`Event found: ${eventId}`);
                return response.Item as Event;
            } else {
                this.logger.warn(`Event not found: ${eventId}`);
                return null;
            }
        } catch (error) {
            this.logger.error(`Error finding event by ID: ${eventId}`, error.stack);
            throw new InternalServerErrorException('Error finding event');
        }
    }

    async create(createEventDto: CreateEventDto, organizerId: string, eventImage: Express.Multer.File): Promise<EventResponseDto> {
        const { name, description, date } = createEventDto;
        this.logger.log(`Creating event with name: ${name}, organizerId: ${organizerId}`);

        const organizer = await this.usersService.findUserById(organizerId);
        if (!organizer) {
            this.logger.warn(`Organizer with ID ${organizerId} not found`);
            throw new NotFoundException('Organizer not found');
        }

        if (organizer.role !== UserRole.ORGANIZER && organizer.role !== UserRole.ADMIN) {
            this.logger.warn(`User with ID ${organizerId} is not authorized to create events`);
            throw new ForbiddenException('You are not authorized to create events');
        }

        if (!organizer.isActive) {
            this.logger.warn(`User with ID ${organizerId} is not active`);
            throw new ForbiddenException('Your account is not active');
        }

        if (await this.eventNameExists(name)) {
            this.logger.warn(`Event with name ${name} already exists`);
            throw new ConflictException('This name is already in use');
        }

        const parseEventDate = new Date(date);
        if (parseEventDate <= new Date()) {
            this.logger.warn(`Event date ${date} is in the past`);
            throw new BadRequestException('Event date cannot be in the past');
        }

        const eventId = uuidv4();
        let eventImageUrl: string = '';
        let s3UploadKey: string | undefined = undefined;

        if (eventImage) {
            try {
                this.logger.log(`Uploading event image for event: ${eventId}`);
                const s3UploadResult = await this.s3Service.uploadFile(eventImage, `events-images`, eventId);
                eventImageUrl = s3UploadResult.Location;
                s3UploadKey = s3UploadResult.Key;
                this.logger.log(`Event image uploaded successfully: ${eventImageUrl}`);
            } catch (error) {
                this.logger.error(`Error uploading event image for event: ${eventId}`, error.stack);
            }
        }

        const newEvent: Event = {
            id: eventId,
            name,
            description,
            date,
            organizerId: organizer.id,
            imageUrl: eventImageUrl,
            status: EventStatus.ACTIVE,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const command = new PutCommand({
            TableName: this.eventsTable,
            Item: newEvent,
            ConditionExpression: 'attribute_not_exists(id)',
        })

        try {
            await this.dynamoDBService.docClient.send(command);
            this.logger.log(`Event created successfully: ${eventId}`);
            return new EventResponseDto(newEvent);
        } catch (error) {
            if (s3UploadKey) {
                this.logger.error(`Error creating event: ${eventId}, removing uploaded image from S3`, error.stack);
                await this.s3Service.deleteFile(s3UploadKey);
            } else {
                this.logger.error(`Error creating event: ${eventId}`, error.stack);
            }
            throw new InternalServerErrorException('Error creating event');
        };
    }
}