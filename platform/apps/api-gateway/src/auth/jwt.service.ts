/**
 * JWT Service
 *
 * Provides RS256 JWT token generation and verification for the authentication system.
 *
 * - Access tokens: RS256 signed, 15-minute expiry, includes sub/email/role/iss/aud
 * - Refresh tokens: HMAC-SHA256 signed, 7-day expiry, includes sub/tokenId/type
 *
 * Uses Node.js native crypto module for signing and verification.
 */

import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AccessTokenPayload {
  sub: string; // userId
  email: string;
  role: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string; // userId
  tokenId: string;
  type: 'refresh';
  iat: number;
  exp: number;
}

export interface TokenPairResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until access token expiry
  refreshTokenId: string; // ID of the refresh token for storage/revocation
}

interface UserForToken {
  id: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtService {
  private readonly logger = new Logger(JwtService.name);
  private readonly privateKey: string;
  private readonly publicKey: string;
  private readonly refreshSecret: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly accessTokenExpirySeconds: number;
  private readonly refreshTokenExpirySeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.privateKey = this.configService.get<string>('app.jwt.privateKey') || this.generateDevKey();
    this.publicKey = this.configService.get<string>('app.jwt.publicKey') || '';
    this.refreshSecret = this.configService.get<string>('app.jwt.refreshSecret') || crypto.randomBytes(32).toString('hex');
    this.issuer = this.configService.get<string>('app.jwt.issuer') || 'gaming-platform';
    this.audience = this.configService.get<string>('app.jwt.audience') || 'gaming-platform-api';
    this.accessTokenExpirySeconds = 15 * 60; // 15 minutes
    this.refreshTokenExpirySeconds = 7 * 24 * 60 * 60; // 7 days
  }

  /**
   * Generate a token pair (access + refresh) for a user.
   *
   * @param user - User object with id, email, and role
   * @returns TokenPairResult with both tokens and metadata
   */
  generateTokenPair(user: UserForToken): TokenPairResult {
    const accessToken = this.generateAccessToken(user);
    const refreshTokenId = crypto.randomUUID();
    const refreshToken = this.generateRefreshToken(user, refreshTokenId);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpirySeconds,
      refreshTokenId,
    };
  }

  /**
   * Generate an RS256-signed access token.
   *
   * Claims:
   * - sub: userId
   * - email: user email
   * - role: user role
   * - iss: issuer (gaming-platform)
   * - aud: audience (gaming-platform-api)
   * - iat: issued at (unix timestamp)
   * - exp: expiration (iat + 15 minutes)
   */
  generateAccessToken(user: UserForToken): string {
    const now = Math.floor(Date.now() / 1000);

    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      iss: this.issuer,
      aud: this.audience,
      iat: now,
      exp: now + this.accessTokenExpirySeconds,
    };

    return this.signRS256(header, payload);
  }

  /**
   * Generate an HMAC-SHA256-signed refresh token.
   *
   * Claims:
   * - sub: userId
   * - tokenId: unique token identifier (for revocation)
   * - type: 'refresh'
   * - iat: issued at
   * - exp: expiration (iat + 7 days)
   */
  generateRefreshToken(user: UserForToken, tokenId: string): string {
    const now = Math.floor(Date.now() / 1000);

    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const payload: RefreshTokenPayload = {
      sub: user.id,
      tokenId,
      type: 'refresh',
      iat: now,
      exp: now + this.refreshTokenExpirySeconds,
    };

    return this.signHS256(header, payload);
  }

  /**
   * Verify and decode a refresh token.
   *
   * @param token - The refresh token string
   * @returns Decoded payload or null if invalid/expired
   */
  verifyRefreshToken(token: string): RefreshTokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const [headerB64, payloadB64, signatureB64] = parts;

      // Verify HMAC-SHA256 signature
      const data = `${headerB64}.${payloadB64}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.refreshSecret)
        .update(data)
        .digest('base64url');

      if (!crypto.timingSafeEqual(
        Buffer.from(signatureB64, 'utf8'),
        Buffer.from(expectedSignature, 'utf8'),
      )) {
        return null;
      }

      // Decode payload
      const payload: RefreshTokenPayload = JSON.parse(
        Buffer.from(payloadB64, 'base64url').toString('utf8'),
      );

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return null;
      }

      // Check type
      if (payload.type !== 'refresh') {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  // ---- Private methods ----

  /**
   * Sign a JWT with RS256 (RSA + SHA-256).
   */
  private signRS256(header: object, payload: object): string {
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const data = `${headerB64}.${payloadB64}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(data);
    signer.end();

    const signature = signer.sign(this.privateKey, 'base64url');
    return `${data}.${signature}`;
  }

  /**
   * Sign a JWT with HS256 (HMAC + SHA-256).
   */
  private signHS256(header: object, payload: object): string {
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const data = `${headerB64}.${payloadB64}`;

    const signature = crypto
      .createHmac('sha256', this.refreshSecret)
      .update(data)
      .digest('base64url');

    return `${data}.${signature}`;
  }

  /**
   * Generate a development-only RSA key pair.
   * In production, keys should be provided via environment variables.
   */
  private generateDevKey(): string {
    this.logger.warn('No JWT private key configured - generating ephemeral key pair for development');
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    // Store public key for verification
    (this as any).publicKey = publicKey;
    return privateKey;
  }
}
