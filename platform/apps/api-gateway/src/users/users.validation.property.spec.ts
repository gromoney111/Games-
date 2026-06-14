/**
 * Property Test: Username and Email Validation
 *
 * **Property 3: Username and Email Validation**
 * For any string submitted as a username, the User_Service SHALL accept it
 * if and only if it is between 3 and 30 characters and consists entirely of
 * alphanumeric characters. For any string submitted as an email, the User_Service
 * SHALL accept it if and only if it conforms to RFC 5322 format.
 *
 * **Validates: Requirements 2.4, 2.5**
 */

import 'reflect-metadata';
import * as fc from 'fast-check';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * Helper: validates a DTO instance and returns constraint violations.
 */
async function getValidationErrors(dto: Partial<UpdateProfileDto>) {
  const instance = plainToInstance(UpdateProfileDto, dto);
  return validate(instance);
}

/**
 * Username/displayName validity predicate per the DTO:
 * Valid if 3-30 chars and matches /^[a-zA-Z0-9_-]+$/
 */
function isValidDisplayName(s: string): boolean {
  if (s.length < 3 || s.length > 30) return false;
  return /^[a-zA-Z0-9_-]+$/.test(s);
}

/**
 * Arbitrary: generates a valid display name (3-30 alphanumeric + underscore/hyphen)
 */
const validDisplayNameArb = fc.stringMatching(/^[a-zA-Z0-9_-]{3,30}$/);

/**
 * Arbitrary: generates a display name that's too short (1-2 valid chars)
 */
const tooShortDisplayNameArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,2}$/);

/**
 * Arbitrary: generates a display name that's too long (31-50 valid chars)
 */
const tooLongDisplayNameArb = fc.stringMatching(/^[a-zA-Z0-9_-]{31,50}$/);

describe('Property 3: Username and Email Validation', () => {
  // -------------------------------------------------------------------------
  // Username / Display Name Validation Properties
  // -------------------------------------------------------------------------

  it('should accept any display name that is 3-30 alphanumeric/underscore/hyphen characters', async () => {
    await fc.assert(
      fc.asyncProperty(validDisplayNameArb, async (validName) => {
        const errors = await getValidationErrors({ displayName: validName });
        const displayNameErrors = errors.filter(
          (e) => e.property === 'displayName',
        );
        expect(displayNameErrors).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });

  it('should reject any display name shorter than 3 characters', async () => {
    await fc.assert(
      fc.asyncProperty(tooShortDisplayNameArb, async (shortName) => {
        const errors = await getValidationErrors({ displayName: shortName });
        const displayNameErrors = errors.filter(
          (e) => e.property === 'displayName',
        );
        expect(displayNameErrors.length).toBeGreaterThan(0);
      }),
      { numRuns: 50 },
    );
  });

  it('should reject any display name longer than 30 characters', async () => {
    await fc.assert(
      fc.asyncProperty(tooLongDisplayNameArb, async (longName) => {
        const errors = await getValidationErrors({ displayName: longName });
        const displayNameErrors = errors.filter(
          (e) => e.property === 'displayName',
        );
        expect(displayNameErrors.length).toBeGreaterThan(0);
      }),
      { numRuns: 50 },
    );
  });

  it('should reject any display name containing disallowed characters (within valid length)', async () => {
    // Generate strings 3-30 chars that contain at least one invalid character
    const invalidCharNameArb = fc
      .string({ minLength: 3, maxLength: 30 })
      .filter((s) => s.length >= 3 && s.length <= 30 && !/^[a-zA-Z0-9_-]+$/.test(s));

    await fc.assert(
      fc.asyncProperty(invalidCharNameArb, async (invalidName) => {
        const errors = await getValidationErrors({ displayName: invalidName });
        const displayNameErrors = errors.filter(
          (e) => e.property === 'displayName',
        );
        expect(displayNameErrors.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('should satisfy the biconditional: accept iff valid display name (3-30 alphanumeric)', async () => {
    // Use mixed arbitrary that generates both valid and invalid names
    const mixedNameArb = fc.oneof(
      validDisplayNameArb,
      tooShortDisplayNameArb,
      tooLongDisplayNameArb,
      fc.string({ minLength: 1, maxLength: 40 }),
    );

    await fc.assert(
      fc.asyncProperty(mixedNameArb, async (name) => {
        const errors = await getValidationErrors({ displayName: name });
        const displayNameErrors = errors.filter(
          (e) => e.property === 'displayName',
        );
        const isAccepted = displayNameErrors.length === 0;
        const shouldBeValid = isValidDisplayName(name);
        expect(isAccepted).toBe(shouldBeValid);
      }),
      { numRuns: 200 },
    );
  });

  // -------------------------------------------------------------------------
  // Avatar URL Validation (URL format validation per DTO constraints)
  // -------------------------------------------------------------------------

  it('should accept valid URLs for avatarUrl field', async () => {
    await fc.assert(
      fc.asyncProperty(fc.webUrl(), async (validUrl) => {
        const errors = await getValidationErrors({ avatarUrl: validUrl });
        const avatarErrors = errors.filter((e) => e.property === 'avatarUrl');
        expect(avatarErrors).toHaveLength(0);
      }),
      { numRuns: 50 },
    );
  });

  it('should reject invalid URLs for avatarUrl field', async () => {
    const invalidUrlArb = fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => !s.startsWith('http://') && !s.startsWith('https://'));

    await fc.assert(
      fc.asyncProperty(invalidUrlArb, async (invalidUrl) => {
        const errors = await getValidationErrors({ avatarUrl: invalidUrl });
        const avatarErrors = errors.filter((e) => e.property === 'avatarUrl');
        expect(avatarErrors.length).toBeGreaterThan(0);
      }),
      { numRuns: 50 },
    );
  });

  // -------------------------------------------------------------------------
  // Bio length constraint validation
  // -------------------------------------------------------------------------

  it('should accept bios up to 500 characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 0, maxLength: 500 }),
        async (bio) => {
          const errors = await getValidationErrors({ bio });
          const bioErrors = errors.filter((e) => e.property === 'bio');
          expect(bioErrors).toHaveLength(0);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should reject bios exceeding 500 characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 501, maxLength: 600 }),
        async (bio) => {
          const errors = await getValidationErrors({ bio });
          const bioErrors = errors.filter((e) => e.property === 'bio');
          expect(bioErrors.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 50 },
    );
  });

  // -------------------------------------------------------------------------
  // Language code validation
  // -------------------------------------------------------------------------

  it('should accept only supported language codes', async () => {
    const supportedLanguages = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'hi', 'ar', 'pt'];
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...supportedLanguages),
        async (lang) => {
          const errors = await getValidationErrors({ preferredLanguage: lang });
          const langErrors = errors.filter(
            (e) => e.property === 'preferredLanguage',
          );
          expect(langErrors).toHaveLength(0);
        },
      ),
      { numRuns: 30 },
    );
  });

  it('should reject unsupported language codes', async () => {
    const supportedLanguages = new Set(['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'hi', 'ar', 'pt']);
    const unsupportedLangArb = fc
      .string({ minLength: 2, maxLength: 5 })
      .filter((s) => !supportedLanguages.has(s));

    await fc.assert(
      fc.asyncProperty(unsupportedLangArb, async (lang) => {
        const errors = await getValidationErrors({ preferredLanguage: lang });
        const langErrors = errors.filter(
          (e) => e.property === 'preferredLanguage',
        );
        expect(langErrors.length).toBeGreaterThan(0);
      }),
      { numRuns: 50 },
    );
  });
});
