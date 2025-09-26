export interface GetPriorityFeeEstimateRpcResponse {
  jsonrpc: string;
  result: {
    priorityFeeEstimate: number;
  };
  id: string;
}
