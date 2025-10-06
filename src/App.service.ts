import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealthMessage(): string {
    return 'Perps Trader API is running! 🚀';
  }
}
