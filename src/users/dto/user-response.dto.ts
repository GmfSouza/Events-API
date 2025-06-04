import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../enums/user-role.enum';

export class UserResponseDto {
  @ApiProperty({
    description: 'The unique identifier of the user',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'The name of the user',
    example: 'Name',
  })
  name: string;

  @ApiProperty({
    description: 'The email of the user',
    example: 'name@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'The phone number of the user',
    example: '+55511912345678',
  })
  phone: string;

  @ApiProperty({
    description: 'The role of the user',
    enum: UserRole,
    example: UserRole.PARTICIPANT,
  })
  role: UserRole;

  @ApiProperty({
    description: 'The profile image URL of the user',
    example: 'https://example.com/profile.jpg',
  })
  profileImageUrl?: string;

  @ApiProperty({
    description: 'The creation date of the user',
    example: '2023-01-01T00:00:00Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'The last update date of the user',
    example: '2023-01-01T00:00:00Z',
  })
  updatedAt: string;

  @ApiProperty({
    description: 'Indicates if the user is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Indicates if the user has validated their email',
    example: false,
  })
  isEmailValidated: boolean;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
