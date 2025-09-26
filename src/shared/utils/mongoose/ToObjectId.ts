import { Types } from 'mongoose';
import { isNil } from '../../utils';

export const toObjectId = (id: string): Types.ObjectId | undefined => {
  return !isNil(id) ? new Types.ObjectId(id) : undefined;
};

export const toObjectSafe = (
  id?: string,
  handleError?: (e?) => void,
): Types.ObjectId | undefined => {
  try {
    return !isNil(id) ? new Types.ObjectId(id) : undefined;
  } catch (e) {
    handleError?.(e);
    return undefined;
  }
};
