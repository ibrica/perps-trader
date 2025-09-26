import { BlockchainSymbol, TxStatus, TxType, Trigger } from '../../constants';

export interface OnFinalizeOptions {
  txId: string;
  txSignature: string;
  status: TxStatus;
  txType: TxType;
  blockchainSymbol: BlockchainSymbol;
  trigger?: Trigger;
  rpcUrl?: string;
  error?: string;
}
