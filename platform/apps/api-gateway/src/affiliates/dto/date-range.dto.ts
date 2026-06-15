/**
 * Date Range DTO
 *
 * Validates date range query parameters for earnings reports.
 *
 * Requirements: 9.4
 */

import { IsOptional, IsDateString } from 'class-validator';

export class DateRangeDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
