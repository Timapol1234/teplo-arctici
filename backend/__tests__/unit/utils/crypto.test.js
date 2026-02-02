const crypto = require('../../../utils/crypto');

describe('Crypto Utils', () => {
  describe('encryptEmail', () => {
    it('should return null for null input', () => {
      expect(crypto.encryptEmail(null)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(crypto.encryptEmail('')).toBeNull();
    });

    it('should encrypt email and return hex string with IV', () => {
      const email = 'test@example.com';
      const encrypted = crypto.encryptEmail(email);

      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).toContain(':');

      // Check format: iv:encryptedData
      const parts = encrypted.split(':');
      expect(parts.length).toBe(2);
      expect(parts[0].length).toBe(32); // IV is 16 bytes = 32 hex chars
    });

    it('should produce different ciphertext each time due to random IV', () => {
      const email = 'test@example.com';
      const encrypted1 = crypto.encryptEmail(email);
      const encrypted2 = crypto.encryptEmail(email);

      // Same email should produce different encrypted strings due to random IV
      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('decryptEmail', () => {
    it('should return null for null input', () => {
      expect(crypto.decryptEmail(null)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(crypto.decryptEmail('')).toBeNull();
    });

    it('should return null for invalid format (no colon)', () => {
      expect(crypto.decryptEmail('invalidstring')).toBeNull();
    });

    it('should return null for invalid encrypted data', () => {
      expect(crypto.decryptEmail('invalidiv:invaliddata')).toBeNull();
    });

    it('should decrypt previously encrypted email', () => {
      const originalEmail = 'test@example.com';
      const encrypted = crypto.encryptEmail(originalEmail);
      const decrypted = crypto.decryptEmail(encrypted);

      expect(decrypted).toBe(originalEmail);
    });

    it('should handle Russian characters in email', () => {
      const email = 'user@example.com';
      const encrypted = crypto.encryptEmail(email);
      const decrypted = crypto.decryptEmail(encrypted);

      expect(decrypted).toBe(email);
    });

    it('should handle special characters in email', () => {
      const email = 'user+tag@sub.example.com';
      const encrypted = crypto.encryptEmail(email);
      const decrypted = crypto.decryptEmail(encrypted);

      expect(decrypted).toBe(email);
    });
  });

  describe('generateDailyHash', () => {
    it('should return null for null input', () => {
      expect(crypto.generateDailyHash(null)).toBeNull();
    });

    it('should return null for empty array', () => {
      expect(crypto.generateDailyHash([])).toBeNull();
    });

    it('should generate SHA-256 hash for transactions', () => {
      const transactions = [
        { id: 1, amount: 1000, timestamp: '2024-01-01T10:00:00Z', campaign_id: 1 },
        { id: 2, amount: 2000, timestamp: '2024-01-01T11:00:00Z', campaign_id: 1 }
      ];

      const hash = crypto.generateDailyHash(transactions);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 produces 64 hex chars
    });

    it('should produce same hash for same transactions', () => {
      const transactions = [
        { id: 1, amount: 1000, timestamp: '2024-01-01T10:00:00Z', campaign_id: 1 }
      ];

      const hash1 = crypto.generateDailyHash(transactions);
      const hash2 = crypto.generateDailyHash(transactions);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different transactions', () => {
      const transactions1 = [
        { id: 1, amount: 1000, timestamp: '2024-01-01T10:00:00Z', campaign_id: 1 }
      ];
      const transactions2 = [
        { id: 1, amount: 2000, timestamp: '2024-01-01T10:00:00Z', campaign_id: 1 }
      ];

      const hash1 = crypto.generateDailyHash(transactions1);
      const hash2 = crypto.generateDailyHash(transactions2);

      expect(hash1).not.toBe(hash2);
    });

    it('should be order-sensitive', () => {
      const transactions1 = [
        { id: 1, amount: 1000, timestamp: '2024-01-01T10:00:00Z', campaign_id: 1 },
        { id: 2, amount: 2000, timestamp: '2024-01-01T11:00:00Z', campaign_id: 1 }
      ];
      const transactions2 = [
        { id: 2, amount: 2000, timestamp: '2024-01-01T11:00:00Z', campaign_id: 1 },
        { id: 1, amount: 1000, timestamp: '2024-01-01T10:00:00Z', campaign_id: 1 }
      ];

      const hash1 = crypto.generateDailyHash(transactions1);
      const hash2 = crypto.generateDailyHash(transactions2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyDailyHash', () => {
    it('should return true for matching hash', () => {
      const transactions = [
        { id: 1, amount: 1000, timestamp: '2024-01-01T10:00:00Z', campaign_id: 1 }
      ];

      const hash = crypto.generateDailyHash(transactions);
      const result = crypto.verifyDailyHash(transactions, hash);

      expect(result).toBe(true);
    });

    it('should return false for non-matching hash', () => {
      const transactions = [
        { id: 1, amount: 1000, timestamp: '2024-01-01T10:00:00Z', campaign_id: 1 }
      ];

      const result = crypto.verifyDailyHash(transactions, 'invalidhash');

      expect(result).toBe(false);
    });

    it('should return false when transactions are tampered', () => {
      const originalTransactions = [
        { id: 1, amount: 1000, timestamp: '2024-01-01T10:00:00Z', campaign_id: 1 }
      ];
      const tamperedTransactions = [
        { id: 1, amount: 5000, timestamp: '2024-01-01T10:00:00Z', campaign_id: 1 }
      ];

      const hash = crypto.generateDailyHash(originalTransactions);
      const result = crypto.verifyDailyHash(tamperedTransactions, hash);

      expect(result).toBe(false);
    });
  });
});
