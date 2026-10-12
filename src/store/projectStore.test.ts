import { describe, expect, it } from 'vitest';
import { createAddAssetCommand } from '@/core/commands/addAsset.ts';
import type { Asset } from '@/core/project.ts';
import { createProjectStore } from './projectStore.ts';

function makeAsset(id: string): Asset {
  return { id, type: 'image', name: `${id}.png`, duration: 5_000_000 };
}

function assetIds(store: ReturnType<typeof createProjectStore>): string[] {
  return store.getState().project.assets.map((asset) => asset.id);
}

describe('projectStore', () => {
  it('dispatch하면 커맨드를 실행하고 히스토리에 쌓는다', () => {
    const store = createProjectStore();

    store.getState().dispatch(createAddAssetCommand(makeAsset('a')));

    expect(assetIds(store)).toEqual(['a']);
    expect(store.getState().past).toHaveLength(1);
  });

  it('undo/redo로 상태를 되돌리고 다시 적용한다', () => {
    const store = createProjectStore();
    store.getState().dispatch(createAddAssetCommand(makeAsset('a')));
    store.getState().dispatch(createAddAssetCommand(makeAsset('b')));

    store.getState().undo();
    expect(assetIds(store)).toEqual(['a']);

    store.getState().undo();
    expect(assetIds(store)).toEqual([]);

    store.getState().redo();
    expect(assetIds(store)).toEqual(['a']);
  });

  it('새 커맨드를 dispatch하면 redo 스택을 비운다', () => {
    const store = createProjectStore();
    store.getState().dispatch(createAddAssetCommand(makeAsset('a')));
    store.getState().undo();

    store.getState().dispatch(createAddAssetCommand(makeAsset('b')));

    expect(store.getState().future).toEqual([]);
    store.getState().redo();
    expect(assetIds(store)).toEqual(['b']);
  });

  it('히스토리가 비어 있으면 undo/redo는 아무것도 하지 않는다', () => {
    const store = createProjectStore();
    const before = store.getState().project;

    store.getState().undo();
    store.getState().redo();

    expect(store.getState().project).toBe(before);
  });
});
