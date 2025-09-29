import { CreateCurrencyDto } from '../';

export const forceGC = (): void => {
  if (typeof global.gc === 'function') {
    global.gc();
  } else {
    // eslint-disable-next-line no-console
    console.log(
      'Garbage collection (gc) not exposed. Use the --expose-gc flag.',
    );
  }
};

export const createTestCurrencyDto = (
  blockchain: string,
  mintAddress?: string,
  decimals?: number,
  symbol?: string,
): CreateCurrencyDto => {
  return {
    symbol: symbol || 'USDC',
    name: symbol || 'USDC',
    mintAddress: mintAddress || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    blockchain,
    decimals: decimals || 6,
    coinMarketCapId: 5426,
  };
};
