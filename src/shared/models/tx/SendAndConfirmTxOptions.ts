import { SubmitOptions } from './SubmitOptions';

export interface SendAndConfirmTxOptions {
  signWithBackendAuthWallet?: boolean;
  submitOptions?: SubmitOptions;
  confirmDelay?: number;
  submitDelay?: number; // we delay the submit in case there is MEV protection
  skipSubmit?: boolean;
  retryIntervalMs?: number;
  submitCount?: number;
  waitForConfirmation?: boolean;
}
