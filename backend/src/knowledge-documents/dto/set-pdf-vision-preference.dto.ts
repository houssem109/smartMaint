import { IsBoolean } from 'class-validator';

export class SetPdfVisionPreferenceDto {
  @IsBoolean()
  enabled: boolean;
}
