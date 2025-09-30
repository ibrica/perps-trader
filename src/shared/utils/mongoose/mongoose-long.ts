import mongoose from 'mongoose';
import BigNumber from 'bignumber.js';
import { castMongoDBBigNumber, castMongoDBBigInt } from './decimal128ToBigInt';

// Load mongoose-long conditionally for runtime
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mongooseLongModule = require('mongoose-long');
  if (typeof mongooseLongModule === 'function') {
    mongooseLongModule(mongoose);
  } else if (mongooseLongModule?.default) {
    mongooseLongModule.default(mongoose);
  }
} catch (e) {
  // Not available in test environment or already loaded
}

export const Long = (mongoose.Schema.Types as any).Long;
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
