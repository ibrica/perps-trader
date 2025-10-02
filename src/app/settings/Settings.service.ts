import { Injectable } from '@nestjs/common';
import { SettingsDocument } from './Settings.schema';
import { SettingsRepository } from './Settings.repository';

@Injectable()
export class SettingsService {
  constructor(private readonly settingsRepository: SettingsRepository) {}

  async getSettings(): Promise<SettingsDocument> {
    return this.settingsRepository.getSettings();
  }
}
