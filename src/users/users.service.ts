import { ConflictException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDbService } from 'src/aws/dynamodb/dynamodb.service';
import { User } from './interfaces/user.interface';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { CreateUserDto } from './dto/create-user.dto';
import { hash } from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand, UpdateCommandInput } from '@aws-sdk/lib-dynamodb';
import { S3Service } from 'src/aws/s3/s3.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
    private readonly tableName: string;
    private readonly emailIndexName: string = 'email-index';
    private readonly logger = new Logger(UsersService.name);

    constructor(
    private readonly dynamoDbService: DynamoDbService,
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service
  ) {
    const usersTableName = this.configService.get<string>('DYNAMODB_TABLE_USERS');
    if (!usersTableName) {
      throw new Error('DYNAMODB_TABLE_USERS environment variable is not set.');
    }
    this.tableName = usersTableName;
    this.logger.log(`UsersService initialized for table: ${this.tableName}`);
  }

    async findUserByEmail(email: string): Promise<User | null> {
        this.logger.log(`Getting user by email: ${email} from ${this.tableName} with index ${this.emailIndexName}`);
        const command = new QueryCommand({
            TableName: this.tableName,
            IndexName: this.emailIndexName,
            KeyConditionExpression: 'email = :emailValue',
            ExpressionAttributeValues: {
                ':emailValue': email,
            },
            Limit: 1,
        });

        try {
            const response = await this.dynamoDbService.docClient.send(command);

            if (response.Items && response.Items.length > 0) {
                const user = response.Items[0] as User;
                return user;
            }    

            return null;
        } catch (error) {
            this.logger.error(`Error to get user by email: ${email}`, error.stack);
            return null;
        }
    }	

    async findUserById(userId: string): Promise<User | null> {
      this.logger.log(`Getting user by id: ${userId} from ${this.tableName}`);
      const command = new GetCommand({
        TableName: this.tableName,
        Key: { id: userId },
      });

      try {
        const response = await this.dynamoDbService.docClient.send(command);
      if(!response.Item) {
        this.logger.error(`User with id ${userId} not found.`);
        return null
      }

      this.logger.log(`User found: ${userId}`);
      return response.Item as User;

      } catch (error) {
        this.logger.error(`Error to get user by id: ${userId}`, error.stack);
        throw new InternalServerErrorException('An internal server error occurred while retrieving the user');
      }
    }

    async create(createUserDto: CreateUserDto, profileImageFile?: Express.Multer.File): Promise<Omit<User, 'password'>> {
        const { name, email, password, phone, role } = createUserDto;
        
        const existingUser = await this.findUserByEmail(email);
        if (existingUser) {
            this.logger.error(`User with email ${email} already exists.`);
            throw new ConflictException(`This email is already in use`);
        }

        const saltRounds = 10;
        const hashedPass = await hash(password, saltRounds);

        const userId = uuidv4();
        let profileImageUrl: string | undefined = undefined;

        if (profileImageFile) {
      try {
        this.logger.log(`Uploading profile image for user ${userId}`);
        const s3UploadResult = await this.s3Service.uploadFile(
          profileImageFile,
          'user-profiles', 
          userId,          
        );
        profileImageUrl = s3UploadResult.Location; 
        this.logger.log(`Profile image uploaded to: ${profileImageUrl}`);
      } catch (s3Error) {
        this.logger.error(`Failed to upload profile image for ${email}: ${s3Error.message}`, s3Error.stack);
        throw new InternalServerErrorException('Failed to upload profile image');
      }
    }

        const newUser: User = {
            id: userId,
            name,
            email,
            password: hashedPass,
            phone,
            role, 
            profileImageUrl,
            isActive: true, 
            isEmailValidated: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const command = new PutCommand({
            TableName: this.tableName,
            Item: newUser,
            ConditionExpression: 'attribute_not_exists(id)', 
        });

        try {
            await this.dynamoDbService.docClient.send(command);
            this.logger.log(`User created successfully: ${newUser.id} (${newUser.email})`);
            const {password: _, ...userWithoutPassword} = newUser;
            return userWithoutPassword;
        } catch (error) {
            this.logger.error(`Error creating user: ${email}`, error);
            throw new InternalServerErrorException('An internal server error occurred while creating the user');
        }
    }

    async update(userId: string, updateUserDto: UpdateUserDto): Promise<Omit<User, 'password'>> {
    this.logger.log(`Updating user: ${userId}`);
    const user = await this.findUserById(userId);
    if (!user) {
      this.logger.error(`User not found: ${userId}`);
      throw new NotFoundException('User not found');
    }

    const updateExpressionParts: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};
    const expressionAttributeNames: Record<string, string> = {};

    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();
    updateExpressionParts.push('#updatedAt = :updatedAt');
    let changes = false;


    if (updateUserDto.name && updateUserDto.name !== user.name) {
      this.logger.log(`Updating name for user: ${userId}`);
      updateExpressionParts.push('#name = :name');
      expressionAttributeNames['#name'] = 'name';
      expressionAttributeValues[':name'] = updateUserDto.name;
      changes = true;
    }

    if(updateUserDto.phone && updateUserDto.phone !== user.phone) {
      expressionAttributeValues[':phone'] = updateUserDto.phone;
      expressionAttributeNames['#phone'] = 'phone';
      updateExpressionParts.push('#phone = :phone');
      changes = true;
    }

    if(updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.findUserByEmail(updateUserDto.email);
      if (existingUser) {
        this.logger.error(`User with email ${updateUserDto.email} already exists.`);
        throw new ConflictException(`This email is already in use`);
      }
      updateExpressionParts.push('email = :email');
      expressionAttributeValues[':email'] = updateUserDto.email;
      updateExpressionParts.push('isEmailValidated = :isEmailValidated');
      expressionAttributeValues[':isEmailValidated'] = false;
      changes = true;
    }

    if(updateUserDto.password) {
      const saltRounds = 10;
      const hashedPass = await hash(updateUserDto.password, saltRounds);
      expressionAttributeNames['#password'] = 'password';
      expressionAttributeValues[':password'] = hashedPass;
      updateExpressionParts.push('#password = :password');
      changes = true;
    }
  
    if(!changes) {
      this.logger.warn(`No changes detected for user: ${userId}`);
      const { password, ...userResponse } = user;
      return userResponse;
    }

    const updateCommandInput: UpdateCommandInput = {
      TableName: this.tableName,
      Key: { id: userId },
      UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    };

    if(Object.keys(expressionAttributeNames).length > 0) {
      updateCommandInput.ExpressionAttributeNames = expressionAttributeNames;
    }

    try {
      const result = await this.dynamoDbService.docClient.send(new UpdateCommand(updateCommandInput));
      this.logger.log(`User with ID ${userId} updated successfully in DynamoDB.`);
      const { password, ...updatedUserWithoutPassword } = result.Attributes as User;
      return updatedUserWithoutPassword;
    } catch (error) {
      this.logger.error(`Error updating user ${userId} in DynamoDB:`, error.stack);
      throw new InternalServerErrorException('Failed to update user.');
    }
    
  }
}