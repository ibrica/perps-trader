import { Entity } from '../../entity';
import { TxStatus, TxType } from '../../../constants';
import { StatusAudit } from './StatusAudit.entity';
import { Trade } from '../../trade';

export class BaseTx extends Entity {
  txType: TxType;

  signature: string;

  creatorPK: string;

  blockchain: string;

  status: TxStatus;

  statusAudits: StatusAudit[];

  mintAddressTo?: string;

  mintAddressFrom?: string;

  trade?: Trade;

  error?: string;

  sessionHash?: string;
}
