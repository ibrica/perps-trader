import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Platform } from '../../shared';
import { CurrencyDocument } from '../currency/Currency.schema';

export type PerpDocument = Perp & Document;

export type PerpDocumentPopulated = Omit<
  PerpDocument,
  'baseCurrency' | 'quoteCurrency'
> & {
  baseCurrency: CurrencyDocument;
  quoteCurrency: CurrencyDocument;
};

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

  @Prop({ type: Types.ObjectId, ref: 'Currency', required: true })
  baseCurrency: string | CurrencyDocument;

  @Prop({ type: Types.ObjectId, ref: 'Currency', required: true })
  quoteCurrency: string | CurrencyDocument;

  @Prop({ type: String, required: true })
  baseAssetSymbol: string;

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

  @Prop({ type: Number })
  marketIndex?: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Number, default: 1 })
  leverage?: number;

  @Prop({ type: String })
  recommendedAmount?: string;

  createdAt?: Date;

  updatedAt?: Date;
}

export const PerpSchema = SchemaFactory.createForClass(Perp);

PerpSchema.index({ platform: 1, buyFlag: 1 });
PerpSchema.index({ marketIndex: 1 });
PerpSchema.index({ baseAssetSymbol: 1 });
PerpSchema.index({ isActive: 1 });
