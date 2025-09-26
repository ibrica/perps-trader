/**
 * Custom type definitions for Hyperliquid infrastructure
 */

export interface EIP712TypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
  };
  types: {
    Message: Array<{ name: string; type: string }>;
  };
  primaryType: string;
  value: {
    content: string;
    timestamp: number;
    nonce: string;
  };
}
