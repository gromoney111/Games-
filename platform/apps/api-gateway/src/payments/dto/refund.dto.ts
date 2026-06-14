/**
 * DTO for refund requests.
 * Validates refund amount and reason.
 *
 * Requirements: 7.6
 */

import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

export class RefundDto {
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Refund amount must be at least 1 cent' })
  amount?: number; // in cents; if omitted, full refund

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
