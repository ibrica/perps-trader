import { TxPriority } from './TxPriority';

export interface SubmitOptions {
  skipPreflight?: boolean;

  priority?: TxPriority;
}
