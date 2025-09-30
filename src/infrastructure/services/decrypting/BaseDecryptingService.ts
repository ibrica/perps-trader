export abstract class BaseDecryptingService {
  abstract decrypt(data: string, secret: string): string;
}
