import { EnterPositionOptions } from './EnterPositionOptions';

export interface PositionExecutionResult {
  orderId: string;
  status: 'success' | 'pending' | 'failed';
  message?: string;
}

export abstract class BasePlatformService {
  abstract enterPosition(
    options: EnterPositionOptions,
  ): Promise<PositionExecutionResult>;

  abstract exitPosition(positionId: string): Promise<PositionExecutionResult>;
}
