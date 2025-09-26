import {
  TxStatus,
  ProtocolVersion,
  FixedSide,
  Trigger,
} from '../../constants2';
import { Priority } from '../../../app/base-tx/priority/Priority.schema';

export interface UpdateBaseTxOptions {
  status?: TxStatus;
  error?: string;
  rpc?: string;
  serializedTx?: string;
  mintAddressFrom?: string;
  mintAddressTo?: string;
  priority?: Priority;
  contractVersion?: ProtocolVersion;
  fixedSide?: FixedSide;
  signature?: string;
  trigger?: Trigger;
}
