import { Decimal128 } from 'mongodb';
import BigNumber from 'bignumber.js';
import { castMongoDBBigNumber, decimal128ToBigInt } from './decimal128ToBigInt';

describe('decimal128ToBigInt', () => {
  it('should convert small number to bigint', () => {
    const decimal = new Decimal128('12345');

    const bigint = decimal128ToBigInt(decimal);
    expect(bigint).toEqual(12345n);
  });

  it('should convert very large number to bigint', () => {
    const decimal = Decimal128.fromStringWithRounding(
      '111111111111111111111111111111111111111111111111111111111',
    );
    const bigint = decimal128ToBigInt(decimal);
    expect(bigint).toEqual(
      111111111111111111111111111111111100000000000000000000000n,
    );
  });

  it('should convert large number to bigint', () => {
    const decimal = Decimal128.fromStringWithRounding(
      '1112222333444455556666777788889999111222333',
    );
    const bigint = decimal128ToBigInt(decimal);
    expect(bigint).toEqual(1112222333444455556666777788889999000000000n);
  });

  it('should convert medium sized number to bigint', () => {
    const decimal = new Decimal128('444455556666777788889999111222333');
    const bigint = decimal128ToBigInt(decimal);
    expect(bigint).toEqual(444455556666777788889999111222333n);
  });

  it('should convert 0 to bigint', () => {
    const decimal = new Decimal128('0');
    const bigint = decimal128ToBigInt(decimal);
    expect(bigint).toEqual(0n);
  });
});

describe('castMongoDBBigNumber', () => {
  it('should cast to big number', () => {
    const decimal = new Decimal128('123.456');

    expect(castMongoDBBigNumber(decimal).toString()).toBe('123.456');
    expect(castMongoDBBigNumber(decimal)).toBeInstanceOf(BigNumber);

    // other tests in case casting from something unexpected...
    expect(castMongoDBBigNumber(123.456).toString()).toBe('123.456');
    expect(castMongoDBBigNumber('123.456').toString()).toBe('123.456');
    expect(castMongoDBBigNumber(BigNumber('123.456')).toString()).toBe(
      '123.456',
    );
  });
});
