import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  TradeType,
  TradeStatus,
  PoolType,
  SwapType,
  deserializeLong,
  Decimal128,
  Platform,
  Blockchain,
} from '../../shared';
import { TradePositionDocument } from '../trade-position/TradePosition.schema';

export type TradeDocument = Trade & Document;

@Schema({
  timestamps: true,
  toObject: {
    transform: (_, ret) =>
      deserializeLong(ret, [
        'amountIn',
        'amountOut',
        'expectedMarginalAmountOut',
      ]),
  },
})
export class Trade {
  static readonly modelName = 'Trade';

  @Prop({ type: String, required: true })
  sender: string;

  @Prop({ type: String, enum: TradeType, required: true })
  tradeType: TradeType;

  @Prop({ type: String, enum: Platform, required: true })
  platform: Platform;

  @Prop({ type: String, enum: TradeStatus, required: true })
  status: TradeStatus;

  @Prop({ type: String, required: true })
  mintFrom: string;

  @Prop({ type: String, required: true })
  mintTo: string;

  @Prop({ type: Decimal128, required: true })
  amountIn: bigint;

  @Prop({ type: Decimal128 })
  amountOut?: bigint;

  @Prop({ type: Decimal128 })
  expectedMarginalAmountOut?: bigint;

  @Prop({ type: Types.ObjectId, ref: 'TradePosition' })
  tradePosition?: string | TradePositionDocument;

  @Prop({ type: String, enum: Blockchain })
  blockchain?: Blockchain;

  createdAt?: Date;

  updatedAt?: Date;
}

export const TradeSchema = SchemaFactory.createForClass(Trade);

TradeSchema.index({ status: 1, createdAt: 1 });
