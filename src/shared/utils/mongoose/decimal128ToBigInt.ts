import { Decimal128 } from 'mongodb';
import BigNumber from 'bignumber.js';

export const decimal128ToBigInt = (decimal128: Decimal128): bigint => {
  const bigNumber = new BigNumber(String(decimal128));
  return BigInt(bigNumber.toFixed());
};

export const castMongoDBBigInt = (largeNumber: unknown): bigint => {
  return decimal128ToBigInt(largeNumber as Decimal128);
};

export const castMongoDBBigNumber = (decimal128Number: unknown): BigNumber =>
  new BigNumber(String(decimal128Number));
