import { TransactionInstruction } from '@solana/web3.js';
import {
  PriorityRouterCreateTipIxOptions,
  PriorityRouterSubmitOptions,
  PriorityRouterSubmitRes,
  PriorityRouter,
} from '../../models';

export abstract class PriorityRouterPort {
  router: PriorityRouter;

  abstract get tipWallet(): string;

  abstract createTipIx(
    options: PriorityRouterCreateTipIxOptions,
  ): Promise<{ ix: TransactionInstruction; tip: bigint }>;

  abstract submit(
    options: PriorityRouterSubmitOptions,
  ): Promise<PriorityRouterSubmitRes>;
}
