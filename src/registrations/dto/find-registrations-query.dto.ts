import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ListUserRegistrationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'The limit must be an integer.' })
  @Min(1, { message: 'The limit must be at least 1.' })
  @Max(50, { message: 'The limit cannot be greater than 50.' })
  limit?: number = 10;

  @IsOptional()
  @IsString()
  lastEvaluatedKey?: string; 
}