/**
 * Users Controller Unit Tests
 *
 * Tests for user profile CRUD endpoints:
 * - GET /users/:id/profile: returns full profile, uses cache
 * - PUT /users/:id/profile: validates and updates profile
 * - Access control: non-admin can only access own profile
 * - Validation error handling
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService, CACHE_CLIENT } from './users.service';
import { UsersRepository } from './users.repository';
import { RequestUser } from '../common/guards/jwt-auth.guard';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;
  let mockCacheClient: any;
  let mockUsersRepository: any;

  const mockProfile = {
    id: 'profile-1',
    userId: 'user-123',
    displayName: 'TestPlayer',
    avatarUrl: 'https://example.com/avatar.png',
    bio: 'I love gaming',
    country: 'US',
    preferredLanguage: 'en',
    notificationPrefs: { email: true, push: true, sms: false },
    privacySettings: { profilePublic: true, showOnlineStatus: true, showGameHistory: true },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  };

  const mockUser: RequestUser = {
    userId: 'user-123',
    email: 'player@example.com',
    role: 'PLAYER',
  };

  const mockAdmin: RequestUser = {
    userId: 'admin-001',
    email: 'admin@example.com',
    role: 'ADMIN',
  };

  beforeEach(async () => {
    mockCacheClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    mockUsersRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      create: jest.fn(),
      createProfile: jest.fn(),
      emailExists: jest.fn(),
      usernameExists: jest.fn(),
      updateLastLogin: jest.fn(),
      findProfileByUserId: jest.fn(),
      updateProfile: jest.fn(),
      getInventory: jest.fn(),
      getGameHistory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: CACHE_CLIENT, useValue: mockCacheClient },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  describe('GET /users/:id/profile', () => {
    it('should return full profile for the authenticated user', async () => {
      mockUsersRepository.findProfileByUserId.mockResolvedValue(mockProfile);

      const result = await controller.getProfile('user-123', mockUser);

      expect(result).toEqual(mockProfile);
      expect(mockUsersRepository.findProfileByUserId).toHaveBeenCalledWith('user-123');
    });

    it('should return cached profile on second call', async () => {
      // First call - cache miss, hits DB
      mockCacheClient.get.mockResolvedValueOnce(null);
      mockUsersRepository.findProfileByUserId.mockResolvedValue(mockProfile);

      await controller.getProfile('user-123', mockUser);

      // Verify cache was populated
      expect(mockCacheClient.setex).toHaveBeenCalledWith(
        'cache:profile:user-123',
        300,
        JSON.stringify(mockProfile),
      );

      // Second call - cache hit (JSON serialized/deserialized so dates become strings)
      mockCacheClient.get.mockResolvedValueOnce(JSON.stringify(mockProfile));

      const result = await controller.getProfile('user-123', mockUser);

      // Cached result will have dates as strings due to JSON serialization
      expect(result).toEqual(JSON.parse(JSON.stringify(mockProfile)));
      // Repository should only have been called once (first call)
      expect(mockUsersRepository.findProfileByUserId).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when profile does not exist', async () => {
      mockUsersRepository.findProfileByUserId.mockResolvedValue(null);

      await expect(
        controller.getProfile('user-123', mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow admin to access any user profile', async () => {
      mockUsersRepository.findProfileByUserId.mockResolvedValue(mockProfile);

      const result = await controller.getProfile('user-123', mockAdmin);

      expect(result).toEqual(mockProfile);
    });

    it('should throw ForbiddenException when non-admin accesses another user profile', async () => {
      const otherUser: RequestUser = {
        userId: 'other-user',
        email: 'other@example.com',
        role: 'PLAYER',
      };

      await expect(
        controller.getProfile('user-123', otherUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('PUT /users/:id/profile', () => {
    it('should validate and update profile with valid data', async () => {
      const dto = { displayName: 'NewName', bio: 'Updated bio' };
      const updatedProfile = { ...mockProfile, ...dto };

      mockUsersRepository.findById.mockResolvedValue({
        id: 'user-123',
        status: 'ACTIVE',
      });
      mockUsersRepository.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfile('user-123', dto, mockUser);

      expect(result).toEqual(updatedProfile);
      expect(mockUsersRepository.updateProfile).toHaveBeenCalledWith('user-123', dto);
    });

    it('should invalidate cache after successful profile update', async () => {
      const dto = { displayName: 'UpdatedName' };

      mockUsersRepository.findById.mockResolvedValue({
        id: 'user-123',
        status: 'ACTIVE',
      });
      mockUsersRepository.updateProfile.mockResolvedValue({ ...mockProfile, ...dto });

      await controller.updateProfile('user-123', dto, mockUser);

      expect(mockCacheClient.del).toHaveBeenCalledWith('cache:profile:user-123');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockUsersRepository.findById.mockResolvedValue(null);

      await expect(
        controller.updateProfile('non-existent', { displayName: 'Test123' }, {
          userId: 'non-existent',
          email: 'test@test.com',
          role: 'PLAYER',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when account is deactivated', async () => {
      mockUsersRepository.findById.mockResolvedValue({
        id: 'user-123',
        status: 'DEACTIVATED',
      });

      await expect(
        controller.updateProfile('user-123', { displayName: 'Test123' }, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when non-admin tries to update another user profile', async () => {
      const otherUser: RequestUser = {
        userId: 'other-user',
        email: 'other@example.com',
        role: 'PLAYER',
      };

      await expect(
        controller.updateProfile('user-123', { displayName: 'Hacked' }, otherUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to update any user profile', async () => {
      const dto = { displayName: 'AdminEdit' };
      const updatedProfile = { ...mockProfile, ...dto };

      mockUsersRepository.findById.mockResolvedValue({
        id: 'user-123',
        status: 'ACTIVE',
      });
      mockUsersRepository.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfile('user-123', dto, mockAdmin);

      expect(result).toEqual(updatedProfile);
    });
  });

  describe('GET /users/:id/inventory', () => {
    it('should return user inventory', async () => {
      const mockInventory = [
        { id: 'txn-1', itemId: 'item-1', amount: 999, status: 'COMPLETED' },
      ];
      mockUsersRepository.getInventory.mockResolvedValue(mockInventory);

      const result = await controller.getInventory('user-123', mockUser);

      expect(result).toEqual(mockInventory);
    });

    it('should throw ForbiddenException when accessing another user inventory', async () => {
      const otherUser: RequestUser = {
        userId: 'other-user',
        email: 'other@example.com',
        role: 'PLAYER',
      };

      await expect(
        controller.getInventory('user-123', otherUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('GET /users/:id/game-history', () => {
    it('should return user game history', async () => {
      const mockHistory = [
        { id: 'result-1', score: 1500, game: { title: '2048', slug: '2048', category: 'puzzle' } },
      ];
      mockUsersRepository.getGameHistory.mockResolvedValue(mockHistory);

      const result = await controller.getGameHistory('user-123', mockUser);

      expect(result).toEqual(mockHistory);
    });

    it('should throw ForbiddenException when accessing another user game history', async () => {
      const otherUser: RequestUser = {
        userId: 'other-user',
        email: 'other@example.com',
        role: 'PLAYER',
      };

      await expect(
        controller.getGameHistory('user-123', otherUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
