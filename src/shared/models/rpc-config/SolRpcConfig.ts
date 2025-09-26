import { RpcOperation } from './RpcOperation';

export interface SolRpcConfig {
  skipPreflight?: boolean;
  weight: number;
  allowedOperations: RpcOperation[];
}
