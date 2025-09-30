export const forceGC = (): void => {
  if (typeof global.gc === 'function') {
    global.gc();
  } else {
    // eslint-disable-next-line no-console
    console.log(
      'Garbage collection (gc) not exposed. Use the --expose-gc flag.',
    );
  }
};
