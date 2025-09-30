import * as CryptoJS from 'crypto-js';
import { BaseDecryptingService } from './BaseDecryptingService';

export class CryptoJsService extends BaseDecryptingService {
  decrypt(encryptedData: string, secret: string): string {
    return CryptoJS.AES.decrypt(encryptedData, secret).toString(
      CryptoJS.enc.Utf8,
    );
  }

  encrypt(data: string, secret: string): string {
    return CryptoJS.AES.encrypt(data, secret).toString();
  }
}
