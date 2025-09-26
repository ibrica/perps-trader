import { Entity } from '../../entity';
import { BlockchainSymbol } from '../../../constants2';

export class BaseBlockchain extends Entity {
  id: string;

  name: string;

  symbol: BlockchainSymbol;
}
