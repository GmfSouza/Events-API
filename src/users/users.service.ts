import { ConflictException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDbService } from 'src/aws/dynamodb/dynamodb.service';
import { User } from './interfaces/user.interface';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { CreateUserDto } from './dto/create-user.dto';
import { hash } from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Service } from 'src/aws/s3/s3.service';

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
}
