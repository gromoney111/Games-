/**
 * Refresh Token DTO
 *
 * Validates the refresh token input for the POST /auth/refresh endpoint.
 * The refresh token must be a non-empty string (JWT format).
 */

import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshDto {
  @IsString({ message: 'Refresh token must be a string' })
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken!: string;
}
