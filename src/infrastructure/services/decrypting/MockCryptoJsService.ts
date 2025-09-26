import { BaseDecryptingService } from './BaseDecryptingService';

/**
 * Mock implementation of CryptoJsService for testing
 * Simply returns the data without actual encryption/decryption
 */
export class MockCryptoJsService extends BaseDecryptingService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  decrypt(encryptedData: string, secret: string): string {
    return encryptedData; // Just return the input data for testing
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  encrypt(data: string, secret: string): string {
    return data; // Just return the input data for testing
  }
}
