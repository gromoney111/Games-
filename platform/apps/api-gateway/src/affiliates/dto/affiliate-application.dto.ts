/**
 * Affiliate Application DTO
 *
 * Validates the affiliate registration application data.
 *
 * Requirements: 9.1
 */

import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class AffiliateApplicationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  websiteUrl!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  promotionMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  audience?: string;
}
