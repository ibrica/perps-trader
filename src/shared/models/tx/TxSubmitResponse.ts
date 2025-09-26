import { TxStatus } from '../../constants2';

export interface TxSubmitResponse {
  transactionSignature: string;
  status: TxStatus;
}
