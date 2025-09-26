import { TxStatus } from '../../constants2';

export interface TxStatusAndSignature {
  status: TxStatus;
  signature: string;
  error?: string;
}
