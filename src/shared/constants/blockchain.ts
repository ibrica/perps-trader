export enum BlockchainSymbol {
  SOL = 'SOL',
  ETH = 'ETH',
  BITCOIN = 'BITCOIN',
  BASE = 'BASE',
}

export enum BlockchainEngineType {
  EVM = 'EVM',
  SOL = 'SOL',
  BTC = 'BTC',
}

export const blockchainEngineMap = new Map<
  BlockchainSymbol,
  BlockchainEngineType
>([
  [BlockchainSymbol.SOL, BlockchainEngineType.SOL],
  [BlockchainSymbol.ETH, BlockchainEngineType.EVM],
  [BlockchainSymbol.BASE, BlockchainEngineType.EVM],
  [BlockchainSymbol.BITCOIN, BlockchainEngineType.BTC],
]);

export function getDefaultBlockChainName(): BlockchainSymbol {
  return BlockchainSymbol.SOL;
}
