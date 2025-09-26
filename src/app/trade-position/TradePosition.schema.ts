import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  deserializeLong,
  Decimal128,
  Platform,
  TradePositionStatus,
  PositionDirection,
  PositionType,
} from '../../shared';

export type TradePositionDocument = TradePosition & Document;

@Schema({
  timestamps: true,
  toObject: {
    transform: (_, ret) =>
      deserializeLong(ret, ['amountIn', 'amountOut', 'positionSize']),
  },
})
export class TradePosition {
  static readonly modelName = 'TradePosition';

  @Prop({ type: String, enum: Platform, required: true })
  platform: Platform;

  @Prop({ type: String, enum: TradePositionStatus, required: true })
  status: TradePositionStatus;

  @Prop({ type: String, enum: PositionType, default: PositionType.SPOT })
  positionType: PositionType;

  @Prop({ type: String })
  tokenMint?: string; // For spot trades

  @Prop({ type: String })
  baseAssetSymbol?: string; // For perp trades

  @Prop({ type: String, required: true })
  currencyMint: string;

  @Prop({ type: Decimal128, required: true })
  amountIn: bigint;

  @Prop({ type: Decimal128 })
  amountOut?: bigint;

  @Prop({ type: Date })
  timeLastPriceUpdate?: Date;

  // Perpetual trading fields (Drift)
  @Prop({ type: String, enum: PositionDirection })
  positionDirection?: PositionDirection;

  @Prop({ type: Number })
  marketIndex?: number;

  @Prop({ type: Number })
  leverage?: number;

  @Prop({ type: Decimal128 })
  positionSize?: bigint;

  @Prop({ type: Number })
  entryPrice?: number;

  @Prop({ type: Number })
  currentPrice?: number;

  @Prop({ type: Number })
  takeProfitPrice?: number;

  @Prop({ type: Number })
  stopLossPrice?: number;

  @Prop({ type: Number })
  unrealizedPnl?: number;

  @Prop({ type: Number })
  realizedPnl?: number;

  @Prop({ type: Date })
  timeOpened?: Date;

  @Prop({ type: Date })
  timeClosed?: Date;

  @Prop({ type: Boolean, default: false })
  exitFlag?: boolean;

  createdAt?: Date;

  updatedAt?: Date;
}

export const TradePositionSchema = SchemaFactory.createForClass(TradePosition);

TradePositionSchema.index({ tokenMint: 1 });
TradePositionSchema.index({ baseAssetSymbol: 1 });
TradePositionSchema.index({ platform: 1, positionType: 1 });
TradePositionSchema.index({ marketIndex: 1 });
