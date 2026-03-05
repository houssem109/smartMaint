import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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
}

