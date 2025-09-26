export interface TradeTxSummary {
  sender: string;
  amountInUSD: number;
  type: 'buy' | 'sell';
  time: number;
}
