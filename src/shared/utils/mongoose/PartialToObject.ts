import { isNil } from '../../utils';

export const partialToObject = <T>(obj: T, fields: string[]): T => {
  const overrides = {};
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (!isNil(obj[field])) {
      if (Array.isArray(obj[field])) {
        overrides[field] = obj[field].map((item) => item.toObject());
      } else {
        overrides[field] = obj[field].toObject();
      }
    }
  }
  return {
    ...obj,
    ...overrides,
  };
};
