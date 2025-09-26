import { Injectable } from '@nestjs/common';
import { CreateBoostTxOptions } from './CreateBoostTxOptions';

@Injectable()
export abstract class BoostDomainPort {
  abstract getTipWallet(): string;

  abstract getJitoTip(options: { totalTip: bigint }): Promise<bigint>;

  abstract createBoostTx(options: CreateBoostTxOptions): Promise<string>;
}
