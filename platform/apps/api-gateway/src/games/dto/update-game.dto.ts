/**
 * Update Game DTO
 *
 * Partial update for game properties.
 * All fields optional; same validation constraints as CreateGameDto.
 */

import {
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  IsObject,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { GameCategory } from './list-games.dto';

export class UpdateGameDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be URL-safe: lowercase alphanumeric with hyphens only',
  })
  slug?: string;

  @IsOptional()
  @IsEnum(GameCategory)
  category?: GameCategory;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  seoMetadata?: Record<string, unknown>;
}
