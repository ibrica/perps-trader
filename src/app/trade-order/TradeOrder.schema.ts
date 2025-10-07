import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { TradeOrderStatus } from '../../shared';
import { TradePositionDocument } from '../trade-position/TradePosition.schema';

export type TradeOrderDocument = TradeOrder & Document;

@Schema({
  timestamps: true,
})
export class TradeOrder {
  static readonly modelName = 'TradePosition';

  @Prop({ type: String, enum: TradeOrderStatus, required: true })
  status: TradeOrderStatus;

  @Prop({
    type: Types.ObjectId,
    required: true, // For now each order is associated with a position
    ref: 'TradePosition',
    index: true,
  })
  position: string | TradePositionDocument;

  // For now string, we'll set the enum in the future when we define the trading scope
  @Prop({ type: String })
  type: string;

  @Prop({ type: String })
  orderId?: string;

  @Prop({ type: String })
  coin?: string;

  @Prop({ type: String })
  side?: string;

  @Prop({ type: Number })
  size?: number;

  @Prop({ type: Number })
  filledSize?: number; // Actual filled amount (may differ from requested size)

  @Prop({ type: Number })
  remainingSize?: number; // Remaining to fill (for partial fills)

  @Prop({ type: Number })
  price?: number;

  @Prop({ type: Number })
  fee?: number;

  @Prop({ type: Number })
  timestampUpdate?: number;

  @Prop({ type: Number })
  timestampFill?: number;

  @Prop({ type: Number })
  closedPnl?: number;

  // OrderUpdate specific fields
  @Prop({ type: Number })
  limitPrice?: number;

  @Prop({ type: Number })
  originalSize?: number;

  @Prop({ type: String })
  clientOrderId?: string;

  // Trigger order specific fields (for SL/TP orders)
  @Prop({ type: Boolean })
  isTrigger?: boolean;

  @Prop({ type: Number })
  triggerPrice?: number;

  @Prop({ type: String })
  triggerType?: 'tp' | 'sl'; // take-profit or stop-loss

  @Prop({ type: Boolean })
  isMarket?: boolean; // Whether trigger order uses market execution

  createdAt?: Date;

  updatedAt?: Date;
}

export const TradeOrderSchema = SchemaFactory.createForClass(TradeOrder);

TradeOrderSchema.index({ orderId: 1 });
