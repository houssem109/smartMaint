import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectKnowledgeEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
