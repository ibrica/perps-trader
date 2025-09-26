export function stringify(value: object): string {
  const objectToStringify = { ...value };
  Object.keys(objectToStringify).forEach((key) => {
    if (typeof objectToStringify[key] === 'bigint') {
      objectToStringify[key] = String(objectToStringify[key]);
    }
  });
  return JSON.stringify(objectToStringify);
}
