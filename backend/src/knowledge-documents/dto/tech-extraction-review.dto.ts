import { IsIn, IsOptional, IsString } from 'class-validator';

export class TechExtractionReviewDto {
  @IsIn(['approve', 'approve_edit', 'reject'])
  action: 'approve' | 'approve_edit' | 'reject';

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  problemDescription?: string;

  @IsOptional()
  @IsString()
  solution?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
