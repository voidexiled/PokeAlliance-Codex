import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QUERY_DELAY_MS, delayedWrite } from '@/components/lists/useListState';

// U5 (spec 7.7.2): `q` filters on every key and reaches the URL 300 ms after the last one.
// The rows follow the field through `useDeferredValue` inside the hook; what can be read
// without a browser is the write of the URL, which is this timer.

describe('U5: the URL takes `q` 300 ms after the last key', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits 300 ms', () => {
    expect(QUERY_DELAY_MS).toBe(300);
  });

  it('writes once, after the last key, with the last value', () => {
    const writes: string[] = [];
    const write = delayedWrite(QUERY_DELAY_MS);

    for (const value of ['c', 'ch', 'cha']) {
      write.schedule(() => writes.push(value));
      vi.advanceTimersByTime(QUERY_DELAY_MS - 1);
    }
    expect(writes).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(writes).toEqual(['cha']);

    vi.advanceTimersByTime(QUERY_DELAY_MS * 2);
    expect(writes).toEqual(['cha']);
  });

  it('drops the write still waiting when it is cancelled (Back, Forward, clearing)', () => {
    const writes: string[] = [];
    const write = delayedWrite(QUERY_DELAY_MS);

    write.schedule(() => writes.push('pika'));
    vi.advanceTimersByTime(QUERY_DELAY_MS - 1);
    write.cancel();
    vi.advanceTimersByTime(QUERY_DELAY_MS * 2);
    expect(writes).toEqual([]);

    write.schedule(() => writes.push('pikachu'));
    vi.advanceTimersByTime(QUERY_DELAY_MS);
    expect(writes).toEqual(['pikachu']);
  });
});
