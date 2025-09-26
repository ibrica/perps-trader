import { Prop, Schema } from '@nestjs/mongoose';

@Schema()
export class AuditDetails {
  @Prop({ type: String })
  creatorIpAddress?: string;
}
