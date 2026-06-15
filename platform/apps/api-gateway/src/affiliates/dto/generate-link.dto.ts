/**
 * Generate Tracking Link DTO
 *
 * Validates the request to generate a new affiliate tracking link for a game.
 *
 * Requirements: 9.2
 */

import { IsString, IsOptional } from 'class-validator';

export class GenerateLinkDto {
  @IsString()
  gameId!: string;

  @IsOptional()
  @IsString()
  campaignName?: string;
}
