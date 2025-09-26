import { Entity } from '../../entity';
import { BlockchainEngineType } from '../../../constants';

export class BlockchainEngine extends Entity {
  id: string;

  type: BlockchainEngineType;
}
