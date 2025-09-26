import { Environment } from '../constants2';

export const isLocalMode = (): boolean => {
  return process.env.ENVIRONMENT === Environment.LOCAL;
};

export const isProdMode = (): boolean => {
  return process.env.ENVIRONMENT === Environment.PROD;
};
