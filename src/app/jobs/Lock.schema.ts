import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LockDocument = Lock & Document;

@Schema({})
export class Lock {
  static readonly modelName = 'Lock';

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: Date, required: true })
  leaseUntil: Date;
}

export const LockSchema = SchemaFactory.createForClass(Lock);
