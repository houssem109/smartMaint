import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateMachineNameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  machineName: string;
}

export class SuggestMachineNameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  proposedName: string;
}

export class ApproveMachineNameSuggestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  /** Shown to technicians whose pending suggestions were auto-rejected. */
  rejectOthersReason?: string;
}

export class RejectMachineNameSuggestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
