/**
 * Update Affiliate Status DTO
 *
 * Validates admin approval/rejection of affiliate applications.
 *
 * Requirements: 9.1
 */

import { IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';

export enum AffiliateStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
  BANNED = 'BANNED',
}

export class UpdateAffiliateStatusDto {
  @IsEnum(AffiliateStatus)
  status!: AffiliateStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
