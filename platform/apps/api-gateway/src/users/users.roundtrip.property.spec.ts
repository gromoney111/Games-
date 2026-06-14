/**
 * Property Test: Profile Update Round-Trip
 *
 * **Property 4: Profile Update Round-Trip**
 * For any valid profile update applied to a user, subsequently retrieving
 * that user's profile SHALL return data reflecting all changes from the update.
 *
 * **Validates: Requirements 2.1, 2.2**
 */

import 'reflect-metadata';
import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService, CACHE_CLIENT, CacheClient } from './users.service';
import { UsersRepository } from './users.repository';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * Arbitrary: generates a valid UpdateProfileDto with random valid fields.
 * Only generates values that would pass the DTO validation.
 */
const validProfileUpdateArb: fc.Arbitrary<Partial<UpdateProfileDto>> = fc.record(
  {
    displayName: fc.stringMatching(/^[a-zA-Z0-9_-]{3,30}$/),
    bio: fc.string({ minLength: 0, maxLength: 500 }),
    preferredLanguage: fc.constantFrom('en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'hi', 'ar', 'pt'),
    country: fc.stringMatching(/^[A-Z]{2}$/),
  },
  { requiredKeys: [] }, // All fields are optional
);

describe('Property 4: Profile Update Round-Trip', () => {
  let usersService: UsersService;
  let mockCacheClient: CacheClient;
  let mockUsersRepository: any;

  // In-memory store to simulate database behavior for round-trip testing
  let profileStore: Record<string, any>;

  beforeEach(async () => {
    profileStore = {};

    // Create an in-memory cache that actually stores and retrieves data
    const cacheStore: Record<string, string> = {};
    mockCacheClient = {
      get: async (key: string) => cacheStore[key] || null,
      set: async (key: string, value: string) => {
        cacheStore[key] = value;
        return 'OK';
      },
      setex: async (key: string, _ttl: number, value: string) => {
        cacheStore[key] = value;
        return 'OK';
      },
      del: async (key: string) => {
        delete cacheStore[key];
        return 1;
      },
    };

    mockUsersRepository = {
      findById: jest.fn().mockImplementation((id: string) => {
        return Promise.resolve({ id, status: 'ACTIVE', email: 'test@example.com', username: 'testuser' });
      }),
      findProfileByUserId: jest.fn().mockImplementation((userId: string) => {
        return Promise.resolve(
          profileStore[userId] || {
            userId,
            displayName: 'OriginalName',
            avatarUrl: null,
            bio: null,
            country: null,
            preferredLanguage: 'en',
            notificationPrefs: { email: true, push: true, sms: false },
            privacySettings: { profilePublic: true, showOnlineStatus: true, showGameHistory: true },
          },
        );
      }),
      updateProfile: jest.fn().mockImplementation((userId: string, data: Partial<UpdateProfileDto>) => {
        const existing = profileStore[userId] || {
          userId,
          displayName: 'OriginalName',
          avatarUrl: null,
          bio: null,
          country: null,
          preferredLanguage: 'en',
          notificationPrefs: { email: true, push: true, sms: false },
          privacySettings: { profilePublic: true, showOnlineStatus: true, showGameHistory: true },
        };
        const updated = { ...existing, ...data };
        profileStore[userId] = updated;
        return Promise.resolve(updated);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: CACHE_CLIENT, useValue: mockCacheClient },
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
  });

  it('should reflect all valid profile changes when profile is subsequently retrieved', async () => {
    await fc.assert(
      fc.asyncProperty(validProfileUpdateArb, async (updateDto) => {
        const userId = 'user-roundtrip-test';

        // Reset the profile store for each property run
        delete profileStore[userId];

        // Apply the profile update
        await usersService.updateProfile(userId, updateDto as UpdateProfileDto);

        // Retrieve the profile
        const retrievedProfile = await usersService.getProfile(userId);

        // Verify that every field in the update DTO is reflected in the retrieved profile
        for (const [key, value] of Object.entries(updateDto)) {
          if (value !== undefined) {
            expect(retrievedProfile[key]).toEqual(value);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should not modify fields that were not included in the update', async () => {
    await fc.assert(
      fc.asyncProperty(validProfileUpdateArb, async (updateDto) => {
        const userId = 'user-preserve-test';

        // Set initial profile state
        const initialProfile = {
          userId,
          displayName: 'InitialName',
          avatarUrl: 'https://example.com/initial.png',
          bio: 'Original bio text',
          country: 'US',
          preferredLanguage: 'en',
          notificationPrefs: { email: true, push: true, sms: false },
          privacySettings: { profilePublic: true, showOnlineStatus: true, showGameHistory: true },
        };
        profileStore[userId] = { ...initialProfile };

        // Apply the update
        await usersService.updateProfile(userId, updateDto as UpdateProfileDto);

        // Retrieve the profile
        const retrievedProfile = await usersService.getProfile(userId);

        // Fields NOT in the update should remain unchanged
        const allFields = ['displayName', 'avatarUrl', 'bio', 'country', 'preferredLanguage', 'notificationPrefs', 'privacySettings'];
        for (const field of allFields) {
          if (!(field in updateDto) || (updateDto as any)[field] === undefined) {
            expect(retrievedProfile[field]).toEqual(initialProfile[field as keyof typeof initialProfile]);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should invalidate cache so subsequent read reflects new data (not stale cache)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z0-9_-]{3,30}$/),
        async (newDisplayName) => {
          const userId = 'user-cache-invalidation-test';

          // Prime the profile store with initial data
          profileStore[userId] = {
            userId,
            displayName: 'OldCachedName',
            avatarUrl: null,
            bio: null,
            country: null,
            preferredLanguage: 'en',
            notificationPrefs: { email: true, push: true, sms: false },
            privacySettings: { profilePublic: true, showOnlineStatus: true, showGameHistory: true },
          };

          // First read - populates cache
          await usersService.getProfile(userId);

          // Update profile
          await usersService.updateProfile(userId, { displayName: newDisplayName } as UpdateProfileDto);

          // Second read - should reflect the new data (cache invalidated)
          const profile = await usersService.getProfile(userId);
          expect(profile.displayName).toBe(newDisplayName);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should ensure profile retrieval returns complete profile structure', async () => {
    await fc.assert(
      fc.asyncProperty(validProfileUpdateArb, async (updateDto) => {
        const userId = 'user-structure-test';
        delete profileStore[userId];

        // Apply update
        await usersService.updateProfile(userId, updateDto as UpdateProfileDto);

        // Retrieve profile
        const profile = await usersService.getProfile(userId);

        // Profile should always have the required structure fields
        expect(profile).toHaveProperty('userId');
        expect(profile).toHaveProperty('displayName');
        expect(profile).toHaveProperty('preferredLanguage');
      }),
      { numRuns: 50 },
    );
  });
});
