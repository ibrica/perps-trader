import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { BaseMongoRepository } from '../../shared';
import { Settings, SettingsDocument } from './Settings.schema';

@Injectable()
export class SettingsRepository extends BaseMongoRepository<SettingsDocument> {
  constructor(
    @InjectModel(Settings.name) settingsModel: Model<SettingsDocument>,
  ) {
    super(settingsModel);
  }

  async getSettings(): Promise<SettingsDocument> {
    const settings = await this.getOne();
    if (!settings) {
      return this.create({
        closeAllPositions: false,
      });
    }
    return settings;
  }
}
