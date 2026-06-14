/**
 * Cryptography Service
 *
 * Provides password hashing (Argon2id), verification, token generation,
 * and salt generation for the authentication system.
 *
 * Argon2id parameters (per requirements):
 * - Time cost: 3 iterations
 * - Memory cost: 65536 KB (64 MB)
 * - Parallelism: 4
 */

import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { Injectable } from '@nestjs/common';

export interface HashedPassword {
  hash: string;
  salt: string;
  algorithm: 'argon2id';
  iterations: number;
}

@Injectable()
export class CryptoService {
  private readonly ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
    type: argon2.argon2id,
    timeCost: 3,
    memoryCost: 65536, // 64 MB
    parallelism: 4,
    hashLength: 32,
  };

  /**
   * Hash a password using Argon2id with a per-user salt.
   *
   * @param password - The plaintext password to hash
   * @returns HashedPassword object containing hash, salt, algorithm, and iterations
   */
  async hashPassword(password: string): Promise<HashedPassword> {
    const salt = this.generateSalt();
    const saltBuffer = Buffer.from(salt, 'hex');

    const hash = await argon2.hash(password, {
      ...this.ARGON2_OPTIONS,
      salt: saltBuffer,
    });

    return {
      hash,
      salt,
      algorithm: 'argon2id',
      iterations: this.ARGON2_OPTIONS.timeCost!,
    };
  }

  /**
   * Verify a password against a stored hash using constant-time comparison.
   *
   * @param password - The plaintext password to verify
   * @param hash - The stored Argon2id hash
   * @returns true if the password matches, false otherwise
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /**
   * Generate a cryptographically secure random token (UUID v4).
   *
   * @returns A random UUID string
   */
  generateToken(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate a cryptographically secure random salt (32 bytes, hex-encoded).
   *
   * @returns A hex-encoded 32-byte salt string
   */
  generateSalt(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Perform a dummy hash computation for constant-time responses.
   * Used when a user is not found to prevent timing-based enumeration.
   */
  async dummyHashComputation(): Promise<void> {
    await argon2.hash('dummy_password_for_timing', this.ARGON2_OPTIONS);
  }
}
