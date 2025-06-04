import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException, Query, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcrypt";
import { User } from "src/users/interfaces/user.interface";
import { UsersService } from "src/users/users.service";
import { JwtPayload } from "./interfaces/jwt-payload.interface";
import { DynamoDbService } from "src/aws/dynamodb/dynamodb.service";
import { ConfigService } from "@nestjs/config";
import { QueryCommand, UpdateCommand, UpdateCommandInput } from "@aws-sdk/lib-dynamodb";

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly emailIndex = 'emailValidationToken-index';
    private readonly usersTableName: string;

    constructor(
        private readonly usersService: UsersService, 
        private readonly jwtService: JwtService,
        private readonly dynamoDbService: DynamoDbService,
        private readonly configService: ConfigService
    ) {
        const tableName = this.configService.get<string>('DYNAMODB_TABLE_USERS');
        if (!tableName) {
            throw new InternalServerErrorException('DYNAMODB_TABLE_USERS is not defined in the environment');
        }

        this.usersTableName = tableName;
    }

    async validateUser(email: string, password: string): Promise<Omit<User, 'password'>> {
        this.logger.debug(`Validating user with email ${email}`);
        const user = await this.usersService.findUserByEmail(email);

        if (!user) {
            this.logger.warn(`User with email ${email} not found`);
            throw new NotFoundException('User not found');
        }

        if (!user.isActive) {
            this.logger.warn(`User with email ${email} is not active`);
            throw new ForbiddenException('User is not active');
        }

         if (!user.password) {
             this.logger.warn(`User with email ${email} does not have a password set`);
             throw new UnauthorizedException('User password not set');
         }
        const validPassword = await compare(password, user.password);
        if (!validPassword) {
            this.logger.warn(`Invalid password for user with email ${email}`);
            throw new UnauthorizedException('Invalid credentials');
        }
        
        const { password: _, ...result } = user;
        return result;
    }

    private async generateToken(user: User): Promise<{ access_token: string }> {
        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: user.role,
        };

        this.logger.log(`Generating JWT token for user with email ${user.email}`);
        return {
            access_token: this.jwtService.sign(payload),
        };
    }

    async login(user: Omit<User, 'password'>): Promise<{ access_token: string }> {
        if (!user.email || !user.role) {
            this.logger.warn('Email or role is missing in user object');
            throw new UnauthorizedException('Email and role must be provided');
        }
        
        return this.generateToken(user);
    }

    async validateTokenEmail(token: string): Promise<void> {
        this.logger.log(`Trying to validate email with token: ${token}`);

        const queryCommand = new QueryCommand({
            TableName: this.usersTableName,
            IndexName: this.emailIndex,
            KeyConditionExpression: 'emailValidationToken = :token',
            ExpressionAttributeValues: {
                ':token': token,
            },
            Limit: 1,
        });

        let userToValidate: User | null = null;
        try {
            const result = await this.dynamoDbService.docClient.send(queryCommand);
            if (result.Items && result.Items.length > 0) {
                userToValidate = result.Items[0] as User;
                this.logger.log(`User found for email validation: ${userToValidate.email}`);
            }
        } catch (error) {
            this.logger.error(`Error validating email token: ${error.message}`);
            throw new InternalServerErrorException('Error validating email token');
        }

        if (!userToValidate) {
            this.logger.warn(`No user found for token: ${token}`);
            throw new BadRequestException('Invalid or expired token');
        }

        if (userToValidate.isEmailValidated) {
            this.logger.warn(`User ${userToValidate.email} is already validated`);
            return;
        }

        if (!userToValidate.emailValidationTokenExpires || new Date(userToValidate.emailValidationTokenExpires) < new Date()) {
            this.logger.warn(`Email validation token for user ${userToValidate.email} has expired`);
            throw new BadRequestException('Email validation token has expired');
        }

        const updateCommandInput: UpdateCommandInput = {
            TableName: this.usersTableName,
            Key: { id: userToValidate.id },
            UpdateExpression: 'SET isEmailValidated = :isEmailValidated REMOVE emailValidationToken, emailValidationTokenExpires',
            ExpressionAttributeValues: {
                ':isEmailValidated': true,
            },
            ReturnValues: 'NONE',
        };

        try {
            await this.dynamoDbService.docClient.send(new UpdateCommand(updateCommandInput));
            this.logger.log(`Email ${userToValidate.email} validation successful for user: ${userToValidate.email}`);
        } catch (error) {
            this.logger.error(`Error updating user ${userToValidate.email}: ${error.message}`);
            throw new InternalServerErrorException('Error updating user email validation status');
        }
    }
}
