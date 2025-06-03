import { IsOptional, IsString, IsEnum, IsInt, Min, Max, IsISO8601, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventStatus } from '../enums/event-status.enum';

export class ListEventsDto {
  @ApiPropertyOptional({
    description: 'Part name of the event to search for',
    example: 'Technolo',
    minLength: 3,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Filter events before this date',
    example: '2026-01-15',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Date must be in the correct format YYYY-MM-DD' })
  dateBefore?: string;

  @ApiPropertyOptional({
    description: 'Filter events after this date',
    example: '2026-01-15',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Date must be in the correct format YYYY-MM-DD' })
  dateAfter?: string;

  @ApiPropertyOptional({
    description: 'Filter events by status',
    enum: EventStatus,
    example: EventStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({
    description: 'Maximum number of events to return',
    default: 10,
    type: Number,
    example: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'The limit must be an integer.' })
  @Min(1, { message: 'The limit must be at least 1.' })
  @Max(50, { message: 'The limit must not be greater than 50.' })
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'The last evaluated key for pagination (JSON string)',
    type: String,
    example: '{"id":"123e4567-e89b-12d3-a456-426614174000"}',
  })
  @IsOptional()
  @IsString()
  lastEvaluatedKey?: string;
}