import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateKnowledgeEntryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  problemDescription: string;

  @IsString()
  @IsNotEmpty()
  solution: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  tags?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  machineName?: string;

  @IsString()
  @IsOptional()
  symptom?: string;

  @IsString()
  @IsOptional()
  rootCause?: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  severity?: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  entryType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  source?: string;

  /** Set when promoting PDF extraction candidates (ignored for technician HTTP creates). */
  @IsUUID()
  @IsOptional()
  knowledgeDocumentId?: string;
}
