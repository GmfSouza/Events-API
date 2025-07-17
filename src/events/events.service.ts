import {
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommandInput,
  UpdateCommand,
  ScanCommand,
  QueryCommandInput,
  ScanCommandInput,
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
import { S3Service } from 'src/aws/s3/s3.service';
import { UsersService } from 'src/users/users.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { UserRole } from 'src/users/enums/user-role.enum';
import { v4 as uuidv4 } from 'uuid';
import { Event } from './interfaces/event.interface';
import { EventStatus } from './enums/event-status.enum';
import { UpdateEventDto } from './dto/update-event.dto';
import { ListEventsDto } from './dto/find-events-query.dto';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly eventsTable: string;
  private readonly eventNameIndex: string = 'name-index';
  private readonly s3EventPath;
  private readonly statusAndDateIndex: string = 'statusAndDate-index';

  constructor(
    private readonly dynamoDBService: DynamoDbService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
  ) {
    const tableName = this.configService.get<string>('DYNAMODB_TABLE_EVENTS');
    if (!tableName) {
      throw new InternalServerErrorException(
        'DYNAMODB_TABLE_EVENTS not defined in environment variables',
      );
    }
    this.s3EventPath = this.configService.get<string>('S3_EVENT_IMAGE_PATH');
    this.eventsTable = tableName;
  }

  private async eventNameExists(name: string): Promise<boolean> {
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
      throw new InternalServerErrorException(
        'Error checking if event name exists',
      );
    }
  }

  async findEventById(eventId: string): Promise<Event | null> {
    const command = new GetCommand({
      TableName: this.eventsTable,
      Key: { id: eventId },
    });

    try {
      const response = await this.dynamoDBService.docClient.send(command);
      if (!response.Item) {
        return null;
      }

      const event = response.Item as Event;
      return event;
    } catch (error) {
      throw new InternalServerErrorException('Error finding event');
    }
  }

  async FindAllEvents(
    listEventsDto: ListEventsDto,
  ): Promise<{ events: Event[]; total: number; lastEvaluatedKey?: string }> {
    const {
      name,
      dateBefore,
      dateAfter,
      status,
      limit = 10,
      lastEvaluatedKey: exclusiveStartKeyString,
    } = listEventsDto;

    let exclusiveStartKey: Record<string, any> | undefined = undefined;
    if (exclusiveStartKeyString) {
      try {
        exclusiveStartKey = JSON.parse(exclusiveStartKeyString);
      } catch (error) {
        throw new BadRequestException('Invalid lastEvaluatedKey');
      }
    }

    const filterExpressionParts: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};
    const expressionAttributeNames: Record<string, string> = {};
    let keyConditionExpression = '';

    let operation: 'Query' | 'Scan';
    let commandInput: QueryCommandInput | ScanCommandInput;

    if (status) {
      operation = 'Query';
      keyConditionExpression = '#statusAttr = :status';
      expressionAttributeNames['#statusAttr'] = 'status';
      expressionAttributeValues[':status'] = status;

      if (dateBefore || dateAfter) {
        expressionAttributeNames['#dateAttr'] = 'date';

        if (dateBefore && dateAfter) {
          keyConditionExpression +=
            ' AND #dateAttr BETWEEN :dateAfter AND :dateBefore';
          expressionAttributeValues[':dateAfter'] = new Date(
            dateAfter,
          ).toISOString();
          expressionAttributeValues[':dateBefore'] = new Date(
            dateBefore,
          ).toISOString();
        } else if (dateBefore) {
          keyConditionExpression += ' AND #dateAttr <= :dateBefore';
          expressionAttributeValues[':dateBefore'] = new Date(
            dateBefore,
          ).toISOString();
        } else if (dateAfter) {
          keyConditionExpression += ' AND #dateAttr >= :dateAfter';
          expressionAttributeValues[':dateAfter'] = new Date(
            dateAfter,
          ).toISOString();
        }
      }

      commandInput = {
        TableName: this.eventsTable,
        IndexName: this.statusAndDateIndex,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
        ScanIndexForward: false,
      };

      if (name) {
        filterExpressionParts.push('contains(#eventName, :name)');
        expressionAttributeNames['#eventName'] = 'name';
        expressionAttributeValues[':name'] = name;
      }
    } else {
      operation = 'Scan';
      if (name) {
        filterExpressionParts.push('contains(#eventName, :name)');
        expressionAttributeNames['#eventName'] = 'name';
        expressionAttributeValues[':name'] = name;
      }

      if (dateAfter || dateBefore) {
        expressionAttributeNames['#dateAttr'] = 'date';

        if (dateAfter) {
          filterExpressionParts.push('#dateAttr >= :dateAfter');
          expressionAttributeValues[':dateAfter'] = new Date(
            dateAfter,
          ).toISOString();
        }

        if (dateBefore) {
          filterExpressionParts.push('#dateAttr <= :dateBefore');
          expressionAttributeValues[':dateBefore'] = new Date(
            dateBefore,
          ).toISOString();
        }
      }

      commandInput = {
        TableName: this.eventsTable,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
      };
    }

    if (filterExpressionParts.length > 0) {
      commandInput.FilterExpression = filterExpressionParts.join(' AND ');
      commandInput.ExpressionAttributeNames = expressionAttributeNames;
      commandInput.ExpressionAttributeValues = expressionAttributeValues;
    }

    if (
      commandInput.ExpressionAttributeNames &&
      Object.keys(commandInput.ExpressionAttributeNames).length === 0
    ) {
      delete commandInput.ExpressionAttributeNames;
    }

    if (
      commandInput.ExpressionAttributeValues &&
      Object.keys(commandInput.ExpressionAttributeValues).length === 0
    ) {
      delete commandInput.ExpressionAttributeValues;
    }

    try {
      let result;

      if (operation === 'Query') {
        const command = new QueryCommand(commandInput as QueryCommandInput);
        result = await this.dynamoDBService.docClient.send(command);
      } else {
        const command = new ScanCommand(commandInput as ScanCommandInput);
        result = await this.dynamoDBService.docClient.send(command);
      }

      const events = (result.Items || []) as Event[];

      return {
        events,
        total: result.Count || 0,
        lastEvaluatedKey: result.LastEvaluatedKey,
      };
    } catch (error) {
      throw new InternalServerErrorException('Error fetching events.');
    }
  }

  async create(
    createEventDto: CreateEventDto,
    organizerId: string,
    eventImage: Express.Multer.File,
  ): Promise<EventResponseDto> {
    const { name, description, date } = createEventDto;
    const organizer = await this.usersService.findUserById(organizerId);
    if (!organizer) {
      throw new InternalServerErrorException('Organizer not found');
    }

    if (
      organizer.role !== UserRole.ORGANIZER &&
      organizer.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('You are not authorized to create events');
    }

    if (!organizer.isActive) {
      throw new ForbiddenException('Your account is not active');
    }

    if (await this.eventNameExists(name)) {
      throw new ConflictException('This name is already in use');
    }

    const parseEventDate = new Date(date);
    if (parseEventDate <= new Date()) {
      throw new BadRequestException('Event date cannot be in the past');
    }

    const eventId = uuidv4();
    let eventImageUrl: string = '';
    let s3UploadKey: string | undefined = undefined;

    if (eventImage) {
      try {
        const s3UploadResult = await this.s3Service.uploadFile(
          eventImage,
          `events-images`,
          eventId,
        );
        eventImageUrl = s3UploadResult.Location;
        s3UploadKey = s3UploadResult.Key;
      } catch (error) {
        this.logger.error(
          `Error uploading event image for event: ${eventId}`,
          error.stack,
        );
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
    });

    try {
      await this.dynamoDBService.docClient.send(command);

      try {
        if (organizer.email) {
          await this.mailService.sendCreatedEventEmail(
            organizer.email,
            organizer.name,
            newEvent.name,
            newEvent.date,
            newEvent.id,
          );
        }
      } catch (error) {
      }

      return new EventResponseDto({
        ...newEvent,
        organizer: {
          id: organizer.id,
          name: organizer.name,
        },
      });
    } catch (error) {
      if (s3UploadKey) {
        await this.s3Service.deleteFile(s3UploadKey);
      } else {
      }
      throw new InternalServerErrorException('Error creating event');
    }
  }

  async update(
    eventId: string,
    updateEventDto: UpdateEventDto,
    requesterId: string,
    eventImage?: Express.Multer.File,
  ): Promise<EventResponseDto> {
    const event = await this.findEventById(eventId);
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const requester = await this.usersService.findUserById(requesterId);
    if (!requester) {
      throw new NotFoundException('Requester not found');
    }

    if (!requester.isActive) {
      throw new ForbiddenException('Your account is not active');
    }

    const isAdmin = requester.role === UserRole.ADMIN;
    const isOrganizer = requester.role === UserRole.ORGANIZER;
    const isOwner = event.organizerId === requester.id;

    if (!(isAdmin || (isOrganizer && isOwner))) {
      throw new ForbiddenException(
        'You are not authorized to update this event',
      );
    }

    const updateExpressionParts: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};
    const expressionAttributeNames: Record<string, string> = {};
    let changes = false;

    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();
    updateExpressionParts.push('#updatedAt = :updatedAt');

    if (updateEventDto.name && updateEventDto.name !== event.name) {
      if (await this.eventNameExists(updateEventDto.name)) {
        throw new ConflictException('This name is already in use');
      }

      expressionAttributeNames['#eventName'] = 'name';
      expressionAttributeValues[':name'] = updateEventDto.name;
      updateExpressionParts.push('#eventName = :name');
      changes = true;
    }

    if (
      updateEventDto.description &&
      updateEventDto.description !== event.description
    ) {
      expressionAttributeNames['#eventDescription'] = 'description';
      expressionAttributeValues[':description'] = updateEventDto.description;
      updateExpressionParts.push('#eventDescription = :description');
      changes = true;
    }

    if (updateEventDto.date && updateEventDto.date !== event.date) {
      const parseEventDate = new Date(updateEventDto.date);
      if (parseEventDate <= new Date()) {
        throw new BadRequestException('Event date cannot be in the past');
      }

      expressionAttributeNames['#eventDate'] = 'date';
      expressionAttributeValues[':date'] = updateEventDto.date;
      updateExpressionParts.push('#eventDate = :date');
      changes = true;
    }

    if (
      updateEventDto.organizerId &&
      updateEventDto.organizerId !== event.organizerId
    ) {
      if (!isAdmin) {
        throw new ForbiddenException('Only admins can change the organizer');
      }
      const newOrganizer = await this.usersService.findUserById(
        updateEventDto.organizerId,
      );
      if (!newOrganizer) {
        throw new NotFoundException('New organizer not found');
      }

      if (
        newOrganizer.role !== UserRole.ORGANIZER &&
        newOrganizer.role !== UserRole.ADMIN
      ) {
        throw new ForbiddenException(
          "The new organizer doesn't have permission to be an organizer",
        );
      }

      expressionAttributeNames['#eventOrganizer'] = 'organizerId';
      expressionAttributeValues[':organizerId'] = updateEventDto.organizerId;
      updateExpressionParts.push('#eventOrganizer = :organizerId');
      changes = true;
    }

    let s3OldKeyToDelete: string | undefined = undefined;
    let s3NewUploadKey: string | undefined = undefined;
    let newImageUrl: string | null | undefined = event.imageUrl;

    if (eventImage) {
      try {
        const url = new URL(event.imageUrl);
        const path = url.pathname.startsWith('/')
          ? url.pathname.slice(1)
          : url.pathname;
        if (path.startsWith(this.s3EventPath)) {
          s3OldKeyToDelete = path;
        }
      } catch (error) {
        this.logger.warn(
          `Error parsing event image URL: ${event.imageUrl}`,
          error.stack,
        );
      }

      try {
        const s3UploadResult = await this.s3Service.uploadFile(
          eventImage,
          `events-images`,
          eventId,
        );
        newImageUrl = s3UploadResult.Location;
        s3NewUploadKey = s3UploadResult.Key;
        updateExpressionParts.push('imageUrl = :imageUrl');
        expressionAttributeValues[':imageUrl'] = newImageUrl;
        changes = true;

        this.logger.log(
          `New event image uploaded successfully: ${newImageUrl}`,
        );
      } catch (error) {
        this.logger.error(
          `Error uploading event image for event: ${eventId}`,
          error.stack,
        );
      }
    }

    if (
      !changes &&
      updateExpressionParts.length === 1 &&
      updateExpressionParts[0].startsWith('#updatedAt')
    ) {
      return event;
    }

    const updateCommandinput: UpdateCommandInput = {
      TableName: this.eventsTable,
      Key: { id: eventId },
      UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    };

    if (Object.keys(expressionAttributeNames).length > 0) {
      updateCommandinput.ExpressionAttributeNames = expressionAttributeNames;
    }

    try {
      const response = await this.dynamoDBService.docClient.send(
        new UpdateCommand(updateCommandinput),
      );
      if (
        s3OldKeyToDelete &&
        s3NewUploadKey &&
        newImageUrl !== event.imageUrl
      ) {
        this.logger.log(
          `Deleting old event image from S3: ${s3OldKeyToDelete}`,
        );
        try {
          await this.s3Service.deleteFile(s3OldKeyToDelete);
          this.logger.log(
            `Old event image deleted successfully: ${s3OldKeyToDelete}`,
          );
        } catch (error) {
          this.logger.error(
            `Error deleting old event image from S3: ${s3OldKeyToDelete}`,
            error.stack,
          );
        }
      }

      return new EventResponseDto({
        ...response.Attributes,
        organizer: {
          id: requester.id,
          name: requester.name,
        },
      });
    } catch (error) {
      if (s3NewUploadKey && newImageUrl !== event.imageUrl) {
        this.logger.warn(
          `Error updating event: ${eventId}, removing new uploaded image from S3`,
          error.stack,
        );
        await this.s3Service.deleteFile(s3NewUploadKey);
      } else {
        this.logger.error(`Error updating event: ${eventId}`, error.stack);
      }
      throw new InternalServerErrorException('Error updating event');
    }
  }
  async softDelete(eventId: string, requesterId: string): Promise<void> {
    const event = await this.findEventById(eventId);
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.status === EventStatus.INACTIVE) {
      throw new BadRequestException('Event already inactive');
    }

    const requester = await this.usersService.findUserById(requesterId);

    if (!requester) {
      throw new NotFoundException('Requester ID not found');
    }

    if (!requester.isActive) {
      throw new ForbiddenException('Your account is not active');
    }

    const isAdmin = requester.role === UserRole.ADMIN;
    const isOwner = event.organizerId === requester.id;
    if (!(isAdmin || isOwner)) {
      throw new ForbiddenException(
        'You are not authorized to delete this event',
      );
    }

    const command = new UpdateCommand({
      TableName: this.eventsTable,
      Key: { id: eventId },
      UpdateExpression: 'SET #statusAttr = :status, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#statusAttr': 'status',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':status': EventStatus.INACTIVE,
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'NONE',
    });

    try {
      await this.dynamoDBService.docClient.send(command);

      const originalOrganizer = await this.usersService.findUserById(
        event.organizerId,
      );
      if (originalOrganizer && originalOrganizer.email) {
        try {
          await this.mailService.sendEventDeletedEmail(
            originalOrganizer.email,
            originalOrganizer.name,
            event.name,
          );
        } catch (error) {
          this.logger.error(
            `Error sending event deleted email for event ${eventId}:`,
            error.stack,
          );
        }
      } else {
        this.logger.warn(
          `Organizer with ID ${event.organizerId} not found or has no email`,
        );
      }
    } catch (error) {
      throw new InternalServerErrorException('Failed to soft delete event');
    }
  }
}
