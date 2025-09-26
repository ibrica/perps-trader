import { Entity } from '../../entity';
import { BlockchainSymbol } from '../../../constants2';
import { BlockchainEngine } from '../../blockchain-engine';

export class Blockchain extends Entity {
  id: string;

  name: string;

  symbol: BlockchainSymbol;

  engine: BlockchainEngine;
}
