import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { deserializeLong, TradeOrderStatus } from '../../shared';
import { TradePositionDocument } from '../trade-position/TradePosition.schema';

export type TradeOrderDocument = TradeOrder & Document;

@Schema({
  timestamps: true,
  toObject: {
    transform: (_, ret) =>
      deserializeLong(ret, ['amountIn', 'amountOut', 'positionSize']),
  },
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

  @Prop({ type: Number })
  size?: number;

  @Prop({ type: Number })
  price?: number;

  @Prop({ type: Number })
  fee?: number;

  createdAt?: Date;

  updatedAt?: Date;
}

export const TradeOrderSchema = SchemaFactory.createForClass(TradeOrder);

TradeOrderSchema.index({ position: 1 });
TradeOrderSchema.index({ orderId: 1 });
