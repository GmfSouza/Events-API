import { IsOptional, IsString, IsEnum, IsInt, Min, Max, IsISO8601, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventStatus } from '../enums/event-status.enum';

export class ListEventsDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Date must be in the correct format YYYY-MM-DD' })
  dateBefore?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Date must be in the correct format YYYY-MM-DD' })
  dateAfter?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'The limit must be an integer.' })
  @Min(1, { message: 'The limit must be at least 1.' })
  @Max(50, { message: 'The limit must not be greater than 50.' })
  limit?: number = 10;

  @IsOptional()
  @IsString()
  lastEvaluatedKey?: string;
}