import { PriorityRouterConfig } from '../../models';

export abstract class PriorityRouterConfigPort {
  abstract getConfig(): Promise<PriorityRouterConfig>;
}
