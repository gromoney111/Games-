/**
 * AuthService Unit Tests
 *
 * Tests for user registration and authentication including:
 * - Successful registration flow
 * - Duplicate email handling (generic error)
 * - Duplicate username handling (generic error)
 * - Password hashing with Argon2id
 * - Login with constant-time response
 * - Account lockout after failed attempts
 * - Token generation on successful login
 */

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CryptoService } from './crypto.service';
import { JwtService } from './jwt.service';
import { RedisService } from './redis.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';

describe('AuthService', () => {
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

  beforeEach(() => {
    cryptoService = {
      hashPassword: jest.fn().mockResolvedValue({
        hash: '$argon2id$v=19$m=65536,t=3,p=4$salt$hash',
        salt: 'a'.repeat(64),
        algorithm: 'argon2id',
        iterations: 3,
      }),
      generateToken: jest.fn().mockReturnValue('test-uuid-token'),
      generateSalt: jest.fn().mockReturnValue('a'.repeat(64)),
      verifyPassword: jest.fn().mockResolvedValue(true),
      dummyHashComputation: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CryptoService>;

    jwtService = {
      generateTokenPair: jest.fn().mockReturnValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 900,
        refreshTokenId: 'refresh-token-id-123',
      }),
      generateAccessToken: jest.fn().mockReturnValue('mock-access-token'),
      generateRefreshToken: jest.fn().mockReturnValue('mock-refresh-token'),
      verifyRefreshToken: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    redisService = {
      getFailedAttempts: jest.fn().mockResolvedValue(0),
      incrementFailedAttempts: jest.fn().mockResolvedValue(1),
      resetFailedAttempts: jest.fn().mockResolvedValue(undefined),
      lockAccount: jest.fn().mockResolvedValue(undefined),
      isAccountLocked: jest.fn().mockResolvedValue(false),
      storeRefreshToken: jest.fn().mockResolvedValue(undefined),
      revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
      revokeAllRefreshTokens: jest.fn().mockResolvedValue(undefined),
      getRefreshToken: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;

    usersService = {
      emailExists: jest.fn().mockResolvedValue(false),
      usernameExists: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockResolvedValue({
        id: 'user-uuid-123',
        email: 'test@example.com',
        username: 'testuser',
        status: 'PENDING',
        role: 'PLAYER',
      }),
      createProfile: jest.fn().mockResolvedValue({
        id: 'profile-uuid-123',
        userId: 'user-uuid-123',
        displayName: 'testuser',
      }),
      findByEmail: jest.fn().mockResolvedValue(mockUser),
      findById: jest.fn(),
      findByUsername: jest.fn(),
      updateLastLogin: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<UsersService>;

    authService = new AuthService(
      cryptoService,
      jwtService,
      redisService,
      usersService,
    );
  });

  describe('register', () => {
    const validDto: RegisterDto = {
      email: 'newuser@example.com',
      password: 'SecureP@ss1',
      username: 'newuser',
    };

    it('should successfully register a new user and return result with userId', async () => {
      const result = await authService.register(validDto);

      expect(result.userId).toBe('user-uuid-123');
      expect(result.email).toBe('test@example.com');
      expect(result.username).toBe('testuser');
      expect(result.status).toBe('PENDING');
      expect(result.message).toContain('Registration successful');
    });

    it('should hash the password with Argon2id', async () => {
      await authService.register(validDto);

      expect(cryptoService.hashPassword).toHaveBeenCalledWith(validDto.password);
    });

    it('should create user with the hashed password', async () => {
      await authService.register(validDto);

      expect(usersService.create).toHaveBeenCalledWith({
        email: validDto.email,
        username: validDto.username,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$salt$hash',
      });
    });

    it('should create a user profile after user creation', async () => {
      await authService.register(validDto);

      expect(usersService.createProfile).toHaveBeenCalledWith({
        userId: 'user-uuid-123',
        displayName: validDto.username,
        preferredLanguage: 'en',
      });
    });

    it('should throw ConflictException with generic message if email exists', async () => {
      usersService.emailExists.mockResolvedValue(true);

      await expect(authService.register(validDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(authService.register(validDto)).rejects.toThrow(
        'Registration could not be completed',
      );
    });

    it('should throw ConflictException with generic message if username exists', async () => {
      usersService.usernameExists.mockResolvedValue(true);

      await expect(authService.register(validDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(authService.register(validDto)).rejects.toThrow(
        'Registration could not be completed',
      );
    });

    it('should not reveal whether email or username caused the conflict', async () => {
      usersService.emailExists.mockResolvedValue(true);
      let errorMessage1 = '';
      try {
        await authService.register(validDto);
      } catch (e: any) {
        errorMessage1 = e.message;
      }

      usersService.emailExists.mockResolvedValue(false);
      usersService.usernameExists.mockResolvedValue(true);
      let errorMessage2 = '';
      try {
        await authService.register(validDto);
      } catch (e: any) {
        errorMessage2 = e.message;
      }

      expect(errorMessage1).toBe(errorMessage2);
    });

    it('should not create user if email already exists', async () => {
      usersService.emailExists.mockResolvedValue(true);

      try {
        await authService.register(validDto);
      } catch {
        // expected
      }

      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should not create user if username already exists', async () => {
      usersService.usernameExists.mockResolvedValue(true);

      try {
        await authService.register(validDto);
      } catch {
        // expected
      }

      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should authenticate valid credentials and return token pair', async () => {
      const result = await authService.login('test@example.com', 'ValidP@ss1');

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(result.expiresIn).toBe(900);
      expect(result.user.id).toBe('user-uuid-123');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.role).toBe('PLAYER');
    });

    it('should perform dummy hash and throw UnauthorizedException when user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login('unknown@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);

      expect(cryptoService.dummyHashComputation).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when account is locked', async () => {
      redisService.isAccountLocked.mockResolvedValue(true);

      await expect(
        authService.login('test@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        authService.login('test@example.com', 'password'),
      ).rejects.toThrow('Account temporarily locked');
    });

    it('should throw UnauthorizedException when account is suspended', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        status: 'SUSPENDED',
      });

      await expect(
        authService.login('test@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        authService.login('test@example.com', 'password'),
      ).rejects.toThrow('Account suspended');
    });

    it('should throw UnauthorizedException when account is inactive (not active or pending)', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        status: 'DEACTIVATED',
      });

      await expect(
        authService.login('test@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        authService.login('test@example.com', 'password'),
      ).rejects.toThrow('Account inactive');
    });

    it('should allow login for PENDING accounts', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        status: 'PENDING',
      });

      const result = await authService.login('test@example.com', 'ValidP@ss1');

      expect(result.accessToken).toBeDefined();
    });

    it('should increment failed attempts on invalid password', async () => {
      cryptoService.verifyPassword.mockResolvedValue(false);

      await expect(
        authService.login('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);

      expect(redisService.incrementFailedAttempts).toHaveBeenCalledWith(
        'user-uuid-123',
      );
    });

    it('should lock account after 5 failed attempts', async () => {
      cryptoService.verifyPassword.mockResolvedValue(false);
      redisService.incrementFailedAttempts.mockResolvedValue(5);

      await expect(
        authService.login('test@example.com', 'wrongpassword'),
      ).rejects.toThrow('Account temporarily locked due to too many failed attempts');

      expect(redisService.lockAccount).toHaveBeenCalledWith('user-uuid-123');
    });

    it('should reset failed attempts on successful login', async () => {
      const result = await authService.login('test@example.com', 'ValidP@ss1');

      expect(result.accessToken).toBeDefined();
      expect(redisService.resetFailedAttempts).toHaveBeenCalledWith(
        'user-uuid-123',
      );
    });

    it('should update last login timestamp on success', async () => {
      await authService.login('test@example.com', 'ValidP@ss1');

      expect(usersService.updateLastLogin).toHaveBeenCalledWith('user-uuid-123');
    });

    it('should generate JWT token pair on success', async () => {
      await authService.login('test@example.com', 'ValidP@ss1');

      expect(jwtService.generateTokenPair).toHaveBeenCalledWith({
        id: 'user-uuid-123',
        email: 'test@example.com',
        role: 'PLAYER',
      });
    });

    it('should store refresh token in Redis on success', async () => {
      await authService.login('test@example.com', 'ValidP@ss1');

      expect(redisService.storeRefreshToken).toHaveBeenCalledWith(
        'user-uuid-123',
        'refresh-token-id-123',
        'mock-refresh-token',
      );
    });

    it('should return generic error message on invalid password (not reveal user exists)', async () => {
      cryptoService.verifyPassword.mockResolvedValue(false);

      await expect(
        authService.login('test@example.com', 'wrongpassword'),
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('logout', () => {
    it('should revoke all refresh tokens for the user', async () => {
      await authService.logout('user-uuid-123');

      expect(redisService.revokeAllRefreshTokens).toHaveBeenCalledWith(
        'user-uuid-123',
      );
    });
  });
});
