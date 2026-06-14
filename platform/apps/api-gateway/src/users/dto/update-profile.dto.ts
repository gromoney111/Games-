/**
 * Update Profile DTO
 *
 * Validation rules for user profile updates.
 * - Display name: 3-30 characters, alphanumeric with underscores and hyphens
 * - Avatar URL: must be a valid URL
 * - Bio: max 500 characters
 * - Country: 2-character code
 * - Preferred language: must be one of the supported language codes
 * - Notification preferences: object with boolean fields
 * - Privacy settings: object with boolean fields
 */

import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsUrl,
  IsIn,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class NotificationPrefsDto {
  @IsOptional()
  @IsBoolean({ message: 'email preference must be a boolean' })
  email?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'push preference must be a boolean' })
  push?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'sms preference must be a boolean' })
  sms?: boolean;
}

export class PrivacySettingsDto {
  @IsOptional()
  @IsBoolean({ message: 'profilePublic must be a boolean' })
  profilePublic?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'showOnlineStatus must be a boolean' })
  showOnlineStatus?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'showGameHistory must be a boolean' })
  showGameHistory?: boolean;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Display name must be at least 3 characters' })
  @MaxLength(30, { message: 'Display name must not exceed 30 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'Display name must contain only alphanumeric characters, underscores, and hyphens',
  })
  displayName?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Avatar URL must be a valid URL' })
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Bio must not exceed 500 characters' })
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2, { message: 'Country code must be at most 2 characters' })
  country?: string;

  @IsOptional()
  @IsString()
  @IsIn(['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'hi', 'ar', 'pt'], {
    message: 'Invalid language code',
  })
  preferredLanguage?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPrefsDto)
  notificationPrefs?: NotificationPrefsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PrivacySettingsDto)
  privacySettings?: PrivacySettingsDto;
}
