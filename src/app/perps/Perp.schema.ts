import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Currency, Platform } from '../../shared';

export type PerpDocument = Perp & Document;

export enum MarketDirection {
  UP = 'up',
  DOWN = 'down',
  NEUTRAL = 'neutral',
}

@Schema({
  timestamps: true,
})
export class Perp {
  static readonly modelName = 'Perp';

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true }) // In future it can be some RWA
  token: string;

  @Prop({ type: String, enum: Currency, required: true })
  currency: Currency;

  @Prop({ type: String, required: true })
  perpSymbol: string;

  @Prop({ type: String, enum: Platform, required: true })
  platform: Platform;

  @Prop({ type: Boolean, default: false })
  buyFlag: boolean;

  @Prop({
    type: String,
    enum: MarketDirection,
    default: MarketDirection.NEUTRAL,
  })
  marketDirection: MarketDirection;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Number, default: 1 })
  defaultLeverage?: number;

  @Prop({ type: Number })
  recommendedAmount?: number;

  createdAt?: Date;

  updatedAt?: Date;
}

export const PerpSchema = SchemaFactory.createForClass(Perp);

PerpSchema.index({ platform: 1, buyFlag: 1 });
PerpSchema.index({ token: 1 });
PerpSchema.index({ isActive: 1 });
