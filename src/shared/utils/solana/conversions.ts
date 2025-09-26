/* eslint-disable no-prototype-builtins */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { BN, web3 } from '@coral-xyz/anchor';

export const convertBigIntToBN = (bigInt: bigint): BN => {
  return new BN(String(bigInt));
};

export const convertPKToBase58 = (obj: any): any => {
  const newObj = {} as any;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (obj[key] instanceof web3.PublicKey) {
        newObj[key] = obj[key].toBase58();
      } else {
        newObj[key] = obj[key];
      }
    }
  }

  return newObj;
};
