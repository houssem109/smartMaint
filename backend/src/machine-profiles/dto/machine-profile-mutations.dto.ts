import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMachineProfileDto {
  @IsString()
  @MaxLength(200)
  machineName: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  manufacturer?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  family?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  modelNumber?: string | null;

  @IsOptional()
  @IsString()
  components?: string | null;
}

export class UpdateMachineProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  machineName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  manufacturer?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  family?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  modelNumber?: string | null;

  @IsOptional()
  @IsString()
  components?: string | null;
}
