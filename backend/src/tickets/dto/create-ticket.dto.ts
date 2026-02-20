import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  TicketCategory,
  TicketPriority,
  TicketSource,
} from '../entities/ticket.entity';

export class CreateTicketDto {
  @ApiProperty({ example: 'Machine A not starting' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'The machine stopped working this morning...' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ enum: TicketCategory, default: TicketCategory.OTHER })
  @IsEnum(TicketCategory)
  @IsOptional()
  category?: TicketCategory;

  @ApiProperty({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;

  @ApiProperty({ example: 'Machine A', required: false })
  @IsString()
  @IsOptional()
  machine?: string;

  @ApiProperty({ example: 'Production Line 1', required: false })
  @IsString()
  @IsOptional()
  area?: string;

  @ApiProperty({ enum: TicketSource, default: TicketSource.WEB })
  @IsEnum(TicketSource)
  @IsOptional()
  source?: TicketSource;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  assignedToId?: string;
}
