/**
 * Registration DTO
 *
 * Validates user registration input: email (RFC 5322), password (complexity),
 * and username (3-30 alphanumeric characters).
 */

import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @MaxLength(254, { message: 'Email must not exceed 254 characters' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/, {
    message: 'Password must contain uppercase, lowercase, number, and special character',
  })
  password!: string;

  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(30, { message: 'Username must not exceed 30 characters' })
  @Matches(/^[a-zA-Z0-9]+$/, { message: 'Username must contain only alphanumeric characters' })
  username!: string;
}
