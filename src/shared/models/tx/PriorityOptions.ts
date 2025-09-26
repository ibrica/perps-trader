import { PriorityRouter } from '../priority-router/PriorityRouter';

export interface PriorityOptions {
  tip: number;
  jitoTip: number;
  router: PriorityRouter;
  frontRunningProtection?: boolean;
  fastBestEffort?: boolean;
  useStakedRPCs?: boolean;
}
