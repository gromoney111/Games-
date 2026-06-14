/**
 * Create Game DTO
 *
 * Validation for game creation (admin endpoint).
 * Enforces: slug URL-safe and unique, title ≤ 100 chars, description ≤ 5000 chars.
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

export class CreateGameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be URL-safe: lowercase alphanumeric with hyphens only (e.g., "my-game-title")',
  })
  slug!: string;

  @IsEnum(GameCategory)
  category!: GameCategory;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  seoMetadata?: Record<string, unknown>;
}
