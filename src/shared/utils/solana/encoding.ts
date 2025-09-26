import base58 from 'bs58';

export const decodeTransactionData = (data: string): string => {
  return base58.encode(Buffer.from(data, 'base64'));
};
