import { PriorityRouter } from '../priority-router/PriorityRouter';

export interface TxPriorityRouterOptions {
  priorityRouter?: PriorityRouter;
  frontRunningProtection?: boolean;
  fastBestEffort?: boolean;
  useStakedRPCs?: boolean;
}
