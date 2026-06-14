/**
 * List Games DTO
 *
 * Validation and transformation for game catalog query parameters.
 * Supports pagination, category filter, tag filter, and search.
 */

import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum GameCategory {
  PUZZLE = 'puzzle',
  ACTION = 'action',
  STRATEGY = 'strategy',
  CASUAL = 'casual',
  MULTIPLAYER = 'multiplayer',
  EDUCATIONAL = 'educational',
}

export class ListGamesDto {
  @IsOptional()
  @IsEnum(GameCategory)
  category?: GameCategory;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  tags?: string; // comma-separated tag list

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
