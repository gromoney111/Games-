/**
 * AuthService Unit Tests
 *
 * Tests for user registration including:
 * - Successful registration flow
 * - Duplicate email handling (generic error)
 * - Duplicate username handling (generic error)
 * - Password hashing with Argon2id
 */

import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CryptoService } from './crypto.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';

describe('AuthService', () => {
  let authService: AuthService;
  let cryptoService: jest.Mocked<CryptoService>;
  let usersService: jest.Mocked<UsersService>;

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
      verifyPassword: jest.fn(),
      dummyHashComputation: jest.fn(),
    } as unknown as jest.Mocked<CryptoService>;

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
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByUsername: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    authService = new AuthService(cryptoService, usersService);
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

      await expect(authService.register(validDto)).rejects.toThrow(ConflictException);
      await expect(authService.register(validDto)).rejects.toThrow(
        'Registration could not be completed',
      );
    });

    it('should throw ConflictException with generic message if username exists', async () => {
      usersService.usernameExists.mockResolvedValue(true);

      await expect(authService.register(validDto)).rejects.toThrow(ConflictException);
      await expect(authService.register(validDto)).rejects.toThrow(
        'Registration could not be completed',
      );
    });

    it('should not reveal whether email or username caused the conflict', async () => {
      // Test email conflict
      usersService.emailExists.mockResolvedValue(true);
      let errorMessage1 = '';
      try {
        await authService.register(validDto);
      } catch (e: any) {
        errorMessage1 = e.message;
      }

      // Reset and test username conflict
      usersService.emailExists.mockResolvedValue(false);
      usersService.usernameExists.mockResolvedValue(true);
      let errorMessage2 = '';
      try {
        await authService.register(validDto);
      } catch (e: any) {
        errorMessage2 = e.message;
      }

      // Both errors should be identical to prevent enumeration
      expect(errorMessage1).toBe(errorMessage2);
    });

    it('should check email existence before username', async () => {
      const callOrder: string[] = [];
      usersService.emailExists.mockImplementation(async () => {
        callOrder.push('emailExists');
        return false;
      });
      usersService.usernameExists.mockImplementation(async () => {
        callOrder.push('usernameExists');
        return false;
      });

      await authService.register(validDto);

      expect(callOrder[0]).toBe('emailExists');
      expect(callOrder[1]).toBe('usernameExists');
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
});
