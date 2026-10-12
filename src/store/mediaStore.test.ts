import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createMediaStore } from './mediaStore.ts';

describe('mediaStore', () => {
  let revokeObjectURL: Mock<(url: string) => void>;

  beforeEach(() => {
    let count = 0;
    URL.createObjectURL = vi.fn(() => `blob:${String(++count)}`);
    revokeObjectURL = vi.fn();
    URL.revokeObjectURL = revokeObjectURL;
  });

  it('파일과 썸네일 URL을 등록한다', () => {
    const store = createMediaStore();
    const file = new File([''], 'a.mp4');

    store.getState().register('a', file, new Blob());

    expect(store.getState().entries['a']).toEqual({ file, thumbnailUrl: 'blob:1' });
  });

  it('해제하면 썸네일 URL을 revoke한다', () => {
    const store = createMediaStore();
    store.getState().register('a', new File([''], 'a.mp4'), new Blob());

    store.getState().release('a');

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:1');
    expect(store.getState().entries['a']).toBeUndefined();
  });

  it('같은 id로 다시 등록하면 이전 URL을 revoke한다', () => {
    const store = createMediaStore();
    store.getState().register('a', new File([''], 'a.mp4'), new Blob());

    store.getState().register('a', new File([''], 'a2.mp4'), new Blob());

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:1');
    expect(store.getState().entries['a']?.thumbnailUrl).toBe('blob:2');
  });
});
