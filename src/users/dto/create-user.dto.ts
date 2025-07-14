import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../enums/user-role.enum';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'Name of the user',
    example: 'Example name',
    minLength: 3,
    maxLength: 70,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3, {
    message: 'Name must be at least 3 characters long',
  })
  @MaxLength(70, {
    message: 'Name must be less than 70 characters long',
  })
  name: string;

  @ApiProperty({
    description: 'Email of the user. Must be a valid email format',
    example: 'user@example.com',
  })
  @IsNotEmpty()
  @IsString()
  @IsEmail()
  @MaxLength(254, {
    message: 'Email must be less than 254 characters long',
  })
  email: string;

  @ApiProperty({
    description:
      'Password of the user. Must contain at least 8 characters, including letters, numbers, and special characters',
    example: 'password123!',
    minLength: 8,
  })
  @IsNotEmpty()
  @IsString()
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,30}$/,
    {
      message:
        'Password must contain minimum 8 characters and maximum 30 characters, including letters, numbers, and special characters',
    },
  )
  password: string;

  @ApiProperty({
    description:
      'Phone number of the user. Must be a valid phone number format',
    example: '+55511912345678',
  })
  @IsNotEmpty()
  @Matches(/^\+?[0-9\s\-()]{10,20}$/, {
    message: 'Phone number format is invalid',
  })
  phone: string;

  @ApiProperty({
    description:
      'Role of the user. Valid roles are: ADMIN, ORGANIZER, PARTICIPANT',
    enum: UserRole,
    example: UserRole.PARTICIPANT,
  })
  @IsEnum(UserRole, {
    message:
      'Invalid user role. Valid roles are: ADMIN, ORGANIZER, PARTICIPANT',
  })
  @IsNotEmpty()
  role: string;
}
