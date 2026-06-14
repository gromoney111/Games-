/**
 * CryptoService Unit Tests
 *
 * Tests for Argon2id password hashing, verification, token/salt generation.
 */

import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let cryptoService: CryptoService;

  beforeEach(() => {
    cryptoService = new CryptoService();
  });

  describe('hashPassword', () => {
    it('should hash a password and return hash, salt, algorithm, and iterations', async () => {
      const result = await cryptoService.hashPassword('TestPass123!');

      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('salt');
      expect(result.algorithm).toBe('argon2id');
      expect(result.iterations).toBe(3);
    });

    it('should produce an Argon2id hash string', async () => {
      const result = await cryptoService.hashPassword('SecureP@ss1');

      // Argon2id hashes start with $argon2id$
      expect(result.hash).toMatch(/^\$argon2id\$/);
    });

    it('should generate a unique salt for each hash operation', async () => {
      const result1 = await cryptoService.hashPassword('Password1!');
      const result2 = await cryptoService.hashPassword('Password1!');

      expect(result1.salt).not.toBe(result2.salt);
      expect(result1.hash).not.toBe(result2.hash);
    });

    it('should generate a 32-byte hex-encoded salt (64 chars)', async () => {
      const result = await cryptoService.hashPassword('Test1234!');

      expect(result.salt).toHaveLength(64);
      expect(result.salt).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for a correct password', async () => {
      const { hash } = await cryptoService.hashPassword('MyP@ssw0rd');
      const result = await cryptoService.verifyPassword('MyP@ssw0rd', hash);

      expect(result).toBe(true);
    });

    it('should return false for an incorrect password', async () => {
      const { hash } = await cryptoService.hashPassword('MyP@ssw0rd');
      const result = await cryptoService.verifyPassword('WrongPassword1!', hash);

      expect(result).toBe(false);
    });

    it('should return false for an invalid hash format', async () => {
      const result = await cryptoService.verifyPassword('test', 'invalid_hash');

      expect(result).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate a valid UUID v4', () => {
      const token = cryptoService.generateToken();

      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('should generate unique tokens', () => {
      const token1 = cryptoService.generateToken();
      const token2 = cryptoService.generateToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('generateSalt', () => {
    it('should generate a 64-character hex string (32 bytes)', () => {
      const salt = cryptoService.generateSalt();

      expect(salt).toHaveLength(64);
      expect(salt).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate unique salts', () => {
      const salt1 = cryptoService.generateSalt();
      const salt2 = cryptoService.generateSalt();

      expect(salt1).not.toBe(salt2);
    });
  });

  describe('dummyHashComputation', () => {
    it('should complete without throwing', async () => {
      await expect(cryptoService.dummyHashComputation()).resolves.not.toThrow();
    });
  });
});
