import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  Platform,
  TradePositionStatus,
  PositionDirection,
  PositionType,
  Currency,
} from '../../shared';

export type TradePositionDocument = TradePosition & Document;

@Schema({
  timestamps: true,
})
export class TradePosition {
  static readonly modelName = 'TradePosition';

  @Prop({ type: String, enum: Platform, required: true })
  platform: Platform;

  @Prop({ type: String, enum: TradePositionStatus, required: true })
  status: TradePositionStatus;

  @Prop({ type: String, enum: PositionType, default: PositionType.PERPETUAL })
  positionType: PositionType;

  @Prop({ type: String })
  token?: string;

  @Prop({ type: String, enum: Currency, required: true })
  currency: Currency;

  @Prop({ type: Number, required: true })
  amountIn: number;

  @Prop({ type: Number })
  amountOut?: number;

  // Perpetual trading fields (Drift)
  @Prop({ type: String, enum: PositionDirection })
  positionDirection?: PositionDirection;

  @Prop({ type: Number })
  leverage?: number;

  @Prop({ type: Number })
  positionSize?: number;

  @Prop({ type: Number })
  entryPrice?: number;

  @Prop({ type: Number })
  currentPrice?: number;

  @Prop({ type: Number })
  takeProfitPrice?: number;

  @Prop({ type: Number })
  stopLossPrice?: number;

  @Prop({ type: Number })
  realizedPnl?: number;

  // Partial fill tracking
  @Prop({ type: Number, default: 0 })
  totalFilledSize?: number; // Accumulated filled size from entry orders

  @Prop({ type: Number, default: 0 })
  totalRealizedPnl?: number; // Accumulated realized PnL from all exit fills

  @Prop({ type: Number })
  remainingSize?: number; // Remaining position size (for partial exits)

  @Prop({
    type: [
      {
        orderId: String,
        size: Number,
        price: Number,
        closedPnl: Number,
        timestamp: Number,
        side: String, // 'B' for buy, 'S' for sell
      },
    ],
    default: [],
  })
  fills?: Array<{
    orderId: string;
    size: number;
    price: number;
    closedPnl?: number;
    timestamp: number;
    side: string;
  }>;

  @Prop({ type: Date })
  timeOpened?: Date;

  @Prop({ type: Date })
  timeClosed?: Date;

  @Prop({ type: Boolean, default: false })
  exitFlag?: boolean;

  // Trailing stop-loss/take-profit tracking
  @Prop({ type: Date })
  lastTrailAt?: Date;

  @Prop({ type: Number, default: 0 })
  trailCount?: number;

  createdAt?: Date;

  updatedAt?: Date;
}

export const TradePositionSchema = SchemaFactory.createForClass(TradePosition);

// Performance indexes
TradePositionSchema.index({ status: 1 });
TradePositionSchema.index({ timeOpened: -1 });
TradePositionSchema.index({ token: 1 });
TradePositionSchema.index({ platform: 1 });
TradePositionSchema.index({ status: 1, timeOpened: -1 });
TradePositionSchema.index({ token: 1, status: 1 });
TradePositionSchema.index({ platform: 1, status: 1 });
TradePositionSchema.index({ baseAssetSymbol: 1 });
TradePositionSchema.index({ platform: 1, positionType: 1 });
TradePositionSchema.index({ marketIndex: 1 });
