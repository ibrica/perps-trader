import { Injectable } from '@nestjs/common';
import { TradeOrderRepository } from './TradeOrder.repository';

@Injectable()
export class TradeOrderService {
  constructor(private readonly tradeOrderRepository: TradeOrderRepository) {}
}
