import { IsOptional, IsString, IsEnum, IsInt, Min, Max, IsISO8601, IsDateString, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventStatus } from '../enums/event-status.enum';

export class ListEventsDto {
  @IsOptional()
  @IsString()
  name?: string;

  @Matches(/^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/25$/, {
    message: 'Date must be in the correct format DD/MM/25',
  })
  @IsOptional()
  dateBefore?: string;

  @IsOptional()
  @Matches(/^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/25$/, {
    message: 'Date must be in the correct format DD/MM/25',
  })
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