import mongoose from 'mongoose';
import mongooseLong from 'mongoose-long';
import BigNumber from 'bignumber.js';
import { castMongoDBBigNumber, castMongoDBBigInt } from './decimal128ToBigInt';

mongooseLong(mongoose);

export const { Long } = mongoose.Schema.Types;
export const { Decimal128 } = mongoose.Schema.Types;

export const deserializeLong = <T>(obj: T, fields: string[]): T => {
  const overrides = {};
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (obj[field] != null) {
      overrides[field] = castMongoDBBigInt(obj[field]);
    }
  }
  return {
    ...obj,
    ...overrides,
  };
};

export const deserializeDecimalToBigNumber = <Obj>(
  obj: Record<keyof Obj, unknown>,
  fields: (keyof Obj)[],
): Record<keyof Obj, unknown> => {
  type OverridesWithNewType = Partial<Record<keyof Obj, BigNumber>>;

  const overrides: OverridesWithNewType = {};
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (obj[field] != null) {
      overrides[field] = castMongoDBBigNumber(obj[field]);
    }
  }
  return {
    ...(obj as Obj),
    ...overrides,
  };
};

export const serializeBigInt = <T>(obj: T, fields: string[]): T => {
  const overrides = {};
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (obj[field] != null) {
      overrides[field] = String(obj[field]);
    }
  }
  return {
    ...obj,
    ...overrides,
  };
};
