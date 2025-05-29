import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../enums/user-role.enum';

export class ListUsersDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsInt({ message: 'page number must be a integer' })
  @Min(1, { message: 'Page number must be at least 1.' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be a integer' })
  @Min(1, { message: 'limit must be at least 1.' })
  @Max(50, { message: 'limit must not be greater than 50.' })
  limit?: number = 10;
}
