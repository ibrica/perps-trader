export const isError = <T>(value: T | Error): value is Error => {
  return value instanceof Error;
};
