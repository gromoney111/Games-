/**
 * Track Event DTO
 *
 * Validates incoming analytics event data.
 * Supports event types: game_start, game_end, purchase, page_view, user_login, ad_impression, ad_click
 *
 * Requirement 15.1
 */

import { IsString, IsOptional, IsIn, IsObject } from 'class-validator';

export const VALID_EVENT_TYPES = [
  'game_start',
  'game_end',
  'purchase',
  'page_view',
  'user_login',
  'ad_impression',
  'ad_click',
] as const;

export type EventType = (typeof VALID_EVENT_TYPES)[number];

export class TrackEventDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  @IsIn(VALID_EVENT_TYPES)
  eventType!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;
}
