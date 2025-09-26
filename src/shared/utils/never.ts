export const never = (x: never): void => {
  throw new Error(`Unexpected case: ${x}`);
};
