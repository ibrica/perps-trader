import { TimeBaseCache } from './TimeBaseCache';
import { delay } from '../../utils';

describe('TimeBaseCache', () => {
  it('should create a cache and add items', () => {
    const cache = new TimeBaseCache(10_000);
    cache.set('first', 1);
    cache.set('second', 2);
    expect(cache.has('first')).toEqual(true);
    expect(cache.has('second')).toEqual(true);
    expect(cache.has('third')).toEqual(false);
  });

  it('should get times', () => {
    const cache = new TimeBaseCache(20_000);
    cache.set('first', 1);
    cache.set('third', 3);
    expect(cache.get('first')).toEqual(1);
    expect(cache.get('second')).toEqual(undefined);
    expect(cache.get('third')).toEqual(3);
  });

  it('should not have expired items', async () => {
    const cache = new TimeBaseCache(1_000);
    cache.set('first', 1);
    cache.set('third', 3);

    await delay(2_000);

    expect(cache.get('first')).toEqual(undefined);
    expect(cache.get('second')).toEqual(undefined);
    expect(cache.get('third')).toEqual(undefined);
    expect(cache.has('first')).toEqual(false);
    expect(cache.has('second')).toEqual(false);
    expect(cache.has('third')).toEqual(false);
  });
});
