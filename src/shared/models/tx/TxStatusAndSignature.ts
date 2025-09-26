import { TxStatus } from '../../constants';

export interface TxStatusAndSignature {
  status: TxStatus;
  signature: string;
  error?: string;
}
