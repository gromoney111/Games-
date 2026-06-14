/**
 * AuthService Token Refresh Unit Tests
 *
 * Tests for token refresh flow (Task 3.5) including:
 * - Successful token refresh with rotation
 * - Invalid/malformed refresh token handling
 * - Expired refresh token handling
 * - Token reuse detection (revokes all tokens)
 * - Inactive user account handling
 * - Old token invalidation after rotation
 */

import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CryptoService } from './crypto.service';
import { JwtService, RefreshTokenPayload } from './jwt.service';
import { RedisService } from './redis.service';
import { UsersService } from '../users/users.service';

describe('AuthService - Token Refresh', () => {
  let authService: AuthService;
  let cryptoService: jest.Mocked<CryptoService>;
  let jwtService: jest.Mocked<JwtService>;
  let redisService: jest.Mocked<RedisService>;
  let usersService: jest.Mocked<UsersService>;

  const mockUser = {
    id: 'user-uuid-123',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$salt$hash',
    status: 'ACTIVE',
    role: 'PLAYER',
    profile: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const validRefreshPayload: RefreshTokenPayload = {
    sub: 'user-uuid-123',
    tokenId: 'refresh-token-id-old',
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 604800,
  };

  beforeEach(() => {
    cryptoService = {
      hashPassword: jest.fn(),
      generateToken: jest.fn(),
      generateSalt: jest.fn(),
      verifyPassword: jest.fn(),
      dummyHashComputation: jest.fn(),
    } as unknown as jest.Mocked<CryptoService>;

    jwtService = {
      generateTokenPair: jest.fn().mockReturnValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
        refreshTokenId: 'refresh-token-id-new',
      }),
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      verifyRefreshToken: jest.fn().mockReturnValue(validRefreshPayload),
    } as unknown as jest.Mocked<JwtService>;

    redisService = {
      getFailedAttempts: jest.fn(),
      incrementFailedAttempts: jest.fn(),
      resetFailedAttempts: jest.fn(),
      lockAccount: jest.fn(),
      isAccountLocked: jest.fn(),
      storeRefreshToken: jest.fn().mockResolvedValue(undefined),
      revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
      revokeAllRefreshTokens: jest.fn().mockResolvedValue(undefined),
      getRefreshToken: jest.fn().mockResolvedValue('valid-refresh-token-string'),
    } as unknown as jest.Mocked<RedisService>;

    usersService = {
      emailExists: jest.fn(),
      usernameExists: jest.fn(),
      create: jest.fn(),
      createProfile: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn().mockResolvedValue(mockUser),
      findByUsername: jest.fn(),
      updateLastLogin: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    authService = new AuthService(
      cryptoService,
      jwtService,
      redisService,
      usersService,
    );
  });

  describe('refresh - successful flow', () => {
    it('should return a new token pair when given a valid stored refresh token', async () => {
      redisService.getRefreshToken.mockResolvedValue('valid-refresh-token-string');

      const result = await authService.refresh('valid-refresh-token-string');

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(result.expiresIn).toBe(900);
    });

    it('should return user info in the result', async () => {
      redisService.getRefreshToken.mockResolvedValue('valid-refresh-token-string');

      const result = await authService.refresh('valid-refresh-token-string');

      expect(result.user).toEqual({
        id: 'user-uuid-123',
        email: 'test@example.com',
        role: 'PLAYER',
      });
    });

    it('should verify the refresh token via JwtService', async () => {
      redisService.getRefreshToken.mockResolvedValue('valid-refresh-token-string');

      await authService.refresh('valid-refresh-token-string');

      expect(jwtService.verifyRefreshToken).toHaveBeenCalledWith('valid-refresh-token-string');
    });

    it('should check token in Redis using userId and tokenId from payload', async () => {
      redisService.getRefreshToken.mockResolvedValue('valid-refresh-token-string');

      await authService.refresh('valid-refresh-token-string');

      expect(redisService.getRefreshToken).toHaveBeenCalledWith(
        'user-uuid-123',
        'refresh-token-id-old',
      );
    });

    it('should verify user is still active by calling findById', async () => {
      redisService.getRefreshToken.mockResolvedValue('valid-refresh-token-string');

      await authService.refresh('valid-refresh-token-string');

      expect(usersService.findById).toHaveBeenCalledWith('user-uuid-123');
    });

    it('should revoke the old refresh token (rotation)', async () => {
      redisService.getRefreshToken.mockResolvedValue('valid-refresh-token-string');

      await authService.refresh('valid-refresh-token-string');

      expect(redisService.revokeRefreshToken).toHaveBeenCalledWith(
        'user-uuid-123',
        'refresh-token-id-old',
      );
    });

    it('should generate a new token pair', async () => {
      redisService.getRefreshToken.mockResolvedValue('valid-refresh-token-string');

      await authService.refresh('valid-refresh-token-string');

      expect(jwtService.generateTokenPair).toHaveBeenCalledWith({
        id: 'user-uuid-123',
        email: 'test@example.com',
        role: 'PLAYER',
      });
    });

    it('should store the new refresh token in Redis', async () => {
      redisService.getRefreshToken.mockResolvedValue('valid-refresh-token-string');

      await authService.refresh('valid-refresh-token-string');

      expect(redisService.storeRefreshToken).toHaveBeenCalledWith(
        'user-uuid-123',
        'refresh-token-id-new',
        'new-refresh-token',
      );
    });
  });

  describe('refresh - invalid token handling', () => {
    it('should throw UnauthorizedException for invalid/malformed token', async () => {
      jwtService.verifyRefreshToken.mockReturnValue(null);

      await expect(authService.refresh('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.refresh('invalid-token')).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should throw UnauthorizedException for expired token', async () => {
      jwtService.verifyRefreshToken.mockReturnValue(null);

      await expect(authService.refresh('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.refresh('expired-token')).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should not check Redis or user service if token verification fails', async () => {
      jwtService.verifyRefreshToken.mockReturnValue(null);

      try {
        await authService.refresh('invalid-token');
      } catch {
        // expected
      }

      expect(redisService.getRefreshToken).not.toHaveBeenCalled();
      expect(usersService.findById).not.toHaveBeenCalled();
    });
  });

  describe('refresh - token reuse detection', () => {
    it('should revoke all tokens when stored token does not match presented token', async () => {
      // Token is valid (signature/expiry OK) but not stored in Redis
      redisService.getRefreshToken.mockResolvedValue(null);

      await expect(authService.refresh('reused-old-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.refresh('reused-old-token')).rejects.toThrow(
        'Token has been revoked',
      );

      expect(redisService.revokeAllRefreshTokens).toHaveBeenCalledWith('user-uuid-123');
    });

    it('should revoke all tokens when stored token value is different from presented', async () => {
      // A different token is stored (old token was already rotated)
      redisService.getRefreshToken.mockResolvedValue('different-token-in-store');

      await expect(authService.refresh('reused-old-token')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(redisService.revokeAllRefreshTokens).toHaveBeenCalledWith('user-uuid-123');
    });

    it('should not generate new tokens when reuse is detected', async () => {
      redisService.getRefreshToken.mockResolvedValue(null);

      try {
        await authService.refresh('reused-old-token');
      } catch {
        // expected
      }

      expect(jwtService.generateTokenPair).not.toHaveBeenCalled();
    });

    it('should not check user status when reuse is detected', async () => {
      redisService.getRefreshToken.mockResolvedValue(null);

      try {
        await authService.refresh('reused-old-token');
      } catch {
        // expected
      }

      expect(usersService.findById).not.toHaveBeenCalled();
    });
  });

  describe('refresh - user status validation', () => {
    it('should throw UnauthorizedException if user is not found', async () => {
      redisService.getRefreshToken.mockResolvedValue('valid-refresh-token-string');
      usersService.findById.mockResolvedValue(null);

      await expect(authService.refresh('valid-refresh-token-string')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.refresh('valid-refresh-token-string')).rejects.toThrow(
        'User account not active',
      );
    });

    it('should throw UnauthorizedException if user account is SUSPENDED', async () => {
      redisService.getRefreshToken.mockResolvedValue('valid-refresh-token-string');
      usersService.findById.mockResolvedValue({ ...mockUser, status: 'SUSPENDED' });

      await expect(authService.refresh('valid-refresh-token-string')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.refresh('valid-refresh-token-string')).rejects.toThrow(
        'User account not active',
      );
    });

    it('should throw UnauthorizedException if user account is DEACTIVATED', async () => {
      redisService.getRefreshToken.mockResolvedValue('valid-refresh-token-string');
      usersService.findById.mockResolvedValue({ ...mockUser, status: 'DEACTIVATED' });

      await expect(authService.refresh('valid-refresh-token-string')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user account is PENDING', async () => {
      redisService.getRefreshToken.mockResolvedValue('valid-refresh-token-string');
      usersService.findById.mockResolvedValue({ ...mockUser, status: 'PENDING' });

      await expect(authService.refresh('valid-refresh-token-string')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should not generate new tokens if user is inactive', async () => {
      redisService.getRefreshToken.mockResolvedValue('valid-refresh-token-string');
      usersService.findById.mockResolvedValue({ ...mockUser, status: 'SUSPENDED' });

      try {
        await authService.refresh('valid-refresh-token-string');
      } catch {
        // expected
      }

      expect(jwtService.generateTokenPair).not.toHaveBeenCalled();
    });
  });

  describe('refresh - token rotation security', () => {
    it('should invalidate old token before generating new one', async () => {
      redisService.getRefreshToken.mockResolvedValue('valid-refresh-token-string');

      const callOrder: string[] = [];
      redisService.revokeRefreshToken.mockImplementation(async () => {
        callOrder.push('revoke');
      });
      jwtService.generateTokenPair.mockImplementation(() => {
        callOrder.push('generate');
        return {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 900,
          refreshTokenId: 'refresh-token-id-new',
        };
      });

      await authService.refresh('valid-refresh-token-string');

      expect(callOrder).toEqual(['revoke', 'generate']);
    });

    it('should use fresh user data for new tokens (not payload from old token)', async () => {
      // User's role changed since the original token was issued
      const updatedUser = { ...mockUser, role: 'ADMIN', email: 'new@example.com' };
      usersService.findById.mockResolvedValue(updatedUser);
      redisService.getRefreshToken.mockResolvedValue('valid-refresh-token-string');

      await authService.refresh('valid-refresh-token-string');

      expect(jwtService.generateTokenPair).toHaveBeenCalledWith({
        id: 'user-uuid-123',
        email: 'new@example.com',
        role: 'ADMIN',
      });
    });
  });
});
