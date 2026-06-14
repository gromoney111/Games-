/**
 * Users Controller Unit Tests
 *
 * Tests for user profile CRUD endpoints and GDPR compliance:
 * - GET /users/:id/profile: returns full profile, uses cache
 * - PUT /users/:id/profile: validates and updates profile
 * - POST /users/:id/deactivate: deactivates account, terminates sessions
 * - GET /users/:id/export: exports all user data in JSON (GDPR Art. 20)
 * - DELETE /users/:id: schedules deletion within 30 days (GDPR Art. 17)
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
      updateStatus: jest.fn(),
      getTransactions: jest.fn(),
      getConsentRecords: jest.fn(),
      getGameSessions: jest.fn(),
      getNotifications: jest.fn(),
      scheduleForDeletion: jest.fn(),
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

  describe('POST /users/:id/deactivate', () => {
    it('should deactivate account and return export ID for the authenticated user', async () => {
      mockUsersRepository.findById.mockResolvedValue({
        id: 'user-123',
        status: 'ACTIVE',
      });
      mockUsersRepository.updateStatus.mockResolvedValue(undefined);

      const result = await controller.deactivateAccount('user-123', mockUser);

      expect(result).toHaveProperty('message');
      expect(result.message).toContain('Account deactivated');
      expect(result).toHaveProperty('exportId');
      expect(typeof result.exportId).toBe('string');
      expect(mockUsersRepository.updateStatus).toHaveBeenCalledWith('user-123', 'DEACTIVATED');
    });

    it('should terminate all sessions on deactivation', async () => {
      mockUsersRepository.findById.mockResolvedValue({
        id: 'user-123',
        status: 'ACTIVE',
      });
      mockUsersRepository.updateStatus.mockResolvedValue(undefined);

      await controller.deactivateAccount('user-123', mockUser);

      // Verify session-related cache keys were deleted
      expect(mockCacheClient.del).toHaveBeenCalledWith('cache:sessions:user-123');
      expect(mockCacheClient.del).toHaveBeenCalledWith('cache:refresh:user-123');
    });

    it('should throw ForbiddenException when non-admin deactivates another user', async () => {
      const otherUser: RequestUser = {
        userId: 'other-user',
        email: 'other@example.com',
        role: 'PLAYER',
      };

      await expect(
        controller.deactivateAccount('user-123', otherUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to deactivate any account', async () => {
      mockUsersRepository.findById.mockResolvedValue({
        id: 'user-123',
        status: 'ACTIVE',
      });
      mockUsersRepository.updateStatus.mockResolvedValue(undefined);

      const result = await controller.deactivateAccount('user-123', mockAdmin);

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('exportId');
    });

    it('should throw NotFoundException when deactivating non-existent user', async () => {
      mockUsersRepository.findById.mockResolvedValue(null);

      await expect(
        controller.deactivateAccount('user-123', mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /users/:id/export', () => {
    it('should export all user data in GDPR-compliant JSON format', async () => {
      const mockUserData = {
        id: 'user-123',
        email: 'player@example.com',
        username: 'testplayer',
        passwordHash: 'secret-hash',
        role: 'PLAYER',
        status: 'ACTIVE',
        profile: mockProfile,
      };
      mockUsersRepository.findById.mockResolvedValue(mockUserData);
      mockUsersRepository.findProfileByUserId.mockResolvedValue(mockProfile);
      mockUsersRepository.getGameHistory.mockResolvedValue([]);
      mockUsersRepository.getGameSessions.mockResolvedValue([]);
      mockUsersRepository.getTransactions.mockResolvedValue([]);
      mockUsersRepository.getConsentRecords.mockResolvedValue([]);
      mockUsersRepository.getNotifications.mockResolvedValue([]);

      const result = await controller.exportData('user-123', mockUser);

      expect(result).toHaveProperty('exportDate');
      expect(result).toHaveProperty('format', 'JSON');
      expect(result).toHaveProperty('gdprCompliance', 'GDPR Article 20 - Right to Data Portability');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('profile');
      expect(result).toHaveProperty('gameHistory');
      expect(result).toHaveProperty('transactions');
      expect(result).toHaveProperty('consentRecords');
      // Ensure password hash is NOT included in export
      expect((result as any).user.passwordHash).toBeUndefined();
    });

    it('should throw ForbiddenException when non-admin exports another user data', async () => {
      const otherUser: RequestUser = {
        userId: 'other-user',
        email: 'other@example.com',
        role: 'PLAYER',
      };

      await expect(
        controller.exportData('user-123', otherUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to export any user data', async () => {
      const mockUserData = {
        id: 'user-123',
        email: 'player@example.com',
        username: 'testplayer',
        passwordHash: 'secret-hash',
        role: 'PLAYER',
        status: 'ACTIVE',
        profile: mockProfile,
      };
      mockUsersRepository.findById.mockResolvedValue(mockUserData);
      mockUsersRepository.findProfileByUserId.mockResolvedValue(mockProfile);
      mockUsersRepository.getGameHistory.mockResolvedValue([]);
      mockUsersRepository.getGameSessions.mockResolvedValue([]);
      mockUsersRepository.getTransactions.mockResolvedValue([]);
      mockUsersRepository.getConsentRecords.mockResolvedValue([]);
      mockUsersRepository.getNotifications.mockResolvedValue([]);

      const result = await controller.exportData('user-123', mockAdmin);

      expect(result).toHaveProperty('exportDate');
      expect(result).toHaveProperty('gdprCompliance');
    });

    it('should throw NotFoundException when exporting non-existent user data', async () => {
      mockUsersRepository.findById.mockResolvedValue(null);

      await expect(
        controller.exportData('user-123', mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('DELETE /users/:id', () => {
    it('should schedule account deletion within 30 days', async () => {
      mockUsersRepository.findById.mockResolvedValue({
        id: 'user-123',
        status: 'ACTIVE',
      });
      mockUsersRepository.scheduleForDeletion.mockResolvedValue(undefined);

      const result = await controller.deleteAccount('user-123', mockUser);

      expect(result).toHaveProperty('message');
      expect(result.message).toContain('scheduled for deletion');
      expect(result.message).toContain('30 days');
      expect(result).toHaveProperty('deletionDate');
      // Verify deletion date is approximately 30 days from now
      const deletionDate = new Date(result.deletionDate);
      const now = new Date();
      const diffDays = Math.round((deletionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(30);
    });

    it('should throw ForbiddenException when non-admin deletes another user', async () => {
      const otherUser: RequestUser = {
        userId: 'other-user',
        email: 'other@example.com',
        role: 'PLAYER',
      };

      await expect(
        controller.deleteAccount('user-123', otherUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to delete any user account', async () => {
      mockUsersRepository.findById.mockResolvedValue({
        id: 'user-123',
        status: 'ACTIVE',
      });
      mockUsersRepository.scheduleForDeletion.mockResolvedValue(undefined);

      const result = await controller.deleteAccount('user-123', mockAdmin);

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('deletionDate');
    });

    it('should throw NotFoundException when deleting non-existent user', async () => {
      mockUsersRepository.findById.mockResolvedValue(null);

      await expect(
        controller.deleteAccount('user-123', mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
