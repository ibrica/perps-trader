import { Entity } from '../../entity';
import { BlockchainEngineType } from '../../../constants2';

export class BlockchainEngine extends Entity {
  id: string;

  type: BlockchainEngineType;
}
