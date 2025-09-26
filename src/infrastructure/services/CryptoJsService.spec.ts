import { CryptoJsService } from './CryptoJsService';

describe('CryptoJsService', () => {
  let service: CryptoJsService;

  beforeEach(() => {
    service = new CryptoJsService();
  });

  describe('encrypt/decrypt', () => {
    const testData = 'Hello, World!';
    const testSecret = 'mySecretKey123';

    it('should encrypt and decrypt data correctly', () => {
      const encrypted = service.encrypt(testData, testSecret);

      const decrypted = service.decrypt(encrypted, testSecret);

      expect(decrypted).toBe(testData);

      // Ensure non-deterministic behavior
      const encrypted2 = service.encrypt(testData, testSecret);
      expect(encrypted).not.toBe(encrypted2);
    });

    it('should handle empty strings', () => {
      const emptyData = '';
      const encrypted = service.encrypt(emptyData, testSecret);
      const decrypted = service.decrypt(encrypted, testSecret);

      expect(decrypted).toBe(emptyData);
    });

    it('should handle special characters', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?`~';
      const encrypted = service.encrypt(specialChars, testSecret);
      const decrypted = service.decrypt(encrypted, testSecret);

      expect(decrypted).toBe(specialChars);
    });

    it('should handle Unicode characters', () => {
      const unicodeText = '你好，世界！🌍';
      const encrypted = service.encrypt(unicodeText, testSecret);
      const decrypted = service.decrypt(encrypted, testSecret);

      expect(decrypted).toBe(unicodeText);
    });
  });
});
