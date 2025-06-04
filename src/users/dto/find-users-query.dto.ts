import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../enums/user-role.enum';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListUsersDto {
  @ApiPropertyOptional({
    description: 'Filter users by part of their name',
    example: 'Souza',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Filter users by email',
    example: 'souza@example.com',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description: 'Filter users by role',
    enum: UserRole,
    example: UserRole.PARTICIPANT,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 10,
    minimum: 1,
    type: Number,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be a integer' })
  @Min(1, { message: 'limit must be at least 1.' })
  @Max(50, { message: 'limit must not be greater than 50.' })
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'The last evaluated key for pagination',
    example: 'someLastEvaluatedKey',
    type: String,
  })
  @IsOptional()
  @IsString()
  lastEvaluatedKey?: string;
}
