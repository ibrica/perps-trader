import { never } from './never';

describe('never', () => {
  it('should throw', () => {
    // @ts-expect-error on never
    const fn = (): void => never('something');

    expect(fn).toThrow('Unexpected case: something');
  });
});
