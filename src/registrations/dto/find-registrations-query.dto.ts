import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ListUserRegistrationsDto {
  @ApiProperty({
    description: 'The maximum number of registrations to return.',
    example: 10,
    minimum: 1,
    maximum: 50,
    required: false,
    default: 10,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'The limit must be an integer.' })
  @Min(1, { message: 'The limit must be at least 1.' })
  @Max(50, { message: 'The limit cannot be greater than 50.' })
  limit?: number = 10;

  @ApiProperty({
    description: 'The last evaluated key for pagination.',
    example: '{"userId":"user-uuid-123","eventId":"event-uuid-abc"}',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsString()
  lastEvaluatedKey?: string; 
}