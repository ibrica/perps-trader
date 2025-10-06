import { Controller, Get } from '@nestjs/common';
import { AppService } from './App.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHealthMessage();
  }

  @Get('health')
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('version')
  getVersion(): { version: string } {
    return { version: process.env.VERSION || 'unknown' };
  }
}
