import { FixedSide, TxType, ProtocolVersion } from '../../constants';
import { TxPriority } from './TxPriority';

export interface CreateBaseTxOptions {
  txType: TxType;
  signature: string;
  creatorPK: string;
  blockchainId: string;
  tokenAddress: string;
  serializedTx?: string;
  trade: string;
  mintAddressFrom?: string;
  mintAddressTo?: string;
  priority?: TxPriority;
  contractVersion?: ProtocolVersion;
  fixedSide?: FixedSide;
}
