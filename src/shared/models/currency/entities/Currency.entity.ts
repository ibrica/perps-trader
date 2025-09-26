import { Blockchain } from '../../blockchain';
import { BaseCurrency } from './BaseCurrency.entity';

export class Currency extends BaseCurrency {
  blockchain: Blockchain;
}
