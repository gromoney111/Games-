/**
 * Date Range DTO
 *
 * Validates date range query parameters for analytics reporting endpoints.
 * Used by admin metrics endpoints.
 *
 * Requirements: 15.2, 15.3, 15.4
 */

import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class DateRangeDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must be in YYYY-MM-DD format',
  })
  startDate!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must be in YYYY-MM-DD format',
  })
  endDate!: string;
}
