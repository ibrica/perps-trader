import crypto from 'crypto';

export class HashingService {
  static encode(data: Buffer | string): string {
    const sha1 = crypto.createHash('sha1');
    return sha1.update(data).digest('base64');
  }
}
