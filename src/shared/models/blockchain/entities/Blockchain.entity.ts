import { Entity } from '../../entity';
import { BlockchainSymbol } from '../../../constants';
import { BlockchainEngine } from '../../blockchain-engine';

export class Blockchain extends Entity {
  id: string;

  name: string;

  symbol: BlockchainSymbol;

  engine: BlockchainEngine;
}
