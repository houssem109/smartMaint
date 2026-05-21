import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTechnicianExperienceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  problem: string;

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
  cause?: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  severity?: string;
}

export class RejectTechnicianExperienceDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  reason?: string;
}
