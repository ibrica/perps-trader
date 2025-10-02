import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SettingsDocument = Settings & Document;

@Schema({ timestamps: true })
export class Settings {
  static readonly modelName = 'Settings';

  @Prop({ type: Boolean })
  closeAllPositions: boolean;

  createdAt?: Date;

  updatedAt?: Date;
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
