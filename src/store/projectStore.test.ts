import { describe, expect, it, vi } from 'vitest';
import { createAddAssetCommand } from '@/core/commands/addAsset.ts';
import type { Asset } from '@/core/project.ts';
import type { Command } from '@/core/commands/command.ts';
import { createProjectStore, HISTORY_LIMIT } from './projectStore.ts';

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

  describe('연속 편집 합치기 (mergeKey)', () => {
    /** 프로젝트 이름을 바꾸는 테스트용 커맨드 */
    function rename(from: string, to: string, mergeKey?: string): Command {
      return {
        label: '이름 변경',
        ...(mergeKey === undefined ? {} : { mergeKey }),
        execute: (project) => ({ ...project, name: to }),
        undo: (project) => ({ ...project, name: from }),
      };
    }

    function setup() {
      let clock = 0;
      const store = createProjectStore(undefined, () => clock);
      const initialName = store.getState().project.name;
      return {
        store,
        initialName,
        tick: (ms: number) => {
          clock += ms;
        },
      };
    }

    it('같은 키가 1초 안에 이어지면 한 항목으로 합치고, undo 한 번에 처음으로 돌아간다', () => {
      const { store, initialName, tick } = setup();
      store.getState().dispatch(rename(initialName, 'a', 'name'));
      tick(300);
      store.getState().dispatch(rename('a', 'ab', 'name'));
      tick(300);
      store.getState().dispatch(rename('ab', 'abc', 'name'));

      expect(store.getState().past).toHaveLength(1);
      expect(store.getState().project.name).toBe('abc');

      store.getState().undo();
      expect(store.getState().project.name).toBe(initialName);
      store.getState().redo();
      expect(store.getState().project.name).toBe('abc');
    });

    it('1초가 지나거나 키가 다르거나 키가 없으면 합치지 않는다', () => {
      const { store, initialName, tick } = setup();
      store.getState().dispatch(rename(initialName, 'a', 'name'));
      tick(1500);
      store.getState().dispatch(rename('a', 'b', 'name'));
      store.getState().dispatch(rename('b', 'c', 'other'));
      store.getState().dispatch(rename('c', 'd'));
      store.getState().dispatch(rename('d', 'e'));

      expect(store.getState().past).toHaveLength(5);
    });

    it('undo 후에는 같은 키라도 합치지 않는다', () => {
      const { store, initialName } = setup();
      store.getState().dispatch(rename(initialName, 'a', 'name'));
      store.getState().dispatch(rename('a', 'b', 'other'));
      store.getState().undo();
      store.getState().dispatch(rename('a', 'c', 'name'));

      expect(store.getState().past).toHaveLength(2);
    });
  });

  describe('실패에 안전한 히스토리', () => {
    const failing: Command = {
      label: '실패',
      execute: () => {
        throw new Error('boom');
      },
      undo: () => {
        throw new Error('boom');
      },
    };

    it('실행이 실패하면 Project와 히스토리를 바꾸지 않고 false를 반환한다', () => {
      const store = createProjectStore();
      const before = store.getState();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      expect(store.getState().dispatch(failing)).toBe(false);

      expect(store.getState().project).toBe(before.project);
      expect(store.getState().past).toBe(before.past);
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('undo가 실패하면 히스토리를 그대로 둔다', () => {
      const store = createProjectStore();
      const undoFails: Command = { ...failing, execute: (project) => ({ ...project, name: 'x' }) };
      store.getState().dispatch(undoFails);
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      expect(store.getState().undo()).toBe(false);

      expect(store.getState().project.name).toBe('x');
      expect(store.getState().past).toHaveLength(1);
      consoleError.mockRestore();
    });

    it('되돌릴 것이 없으면 false', () => {
      const store = createProjectStore();

      expect(store.getState().undo()).toBe(false);
      expect(store.getState().redo()).toBe(false);
    });

    it('히스토리는 최근 200개까지만 보관한다', () => {
      const store = createProjectStore();
      for (let index = 0; index < HISTORY_LIMIT + 50; index++) {
        store.getState().dispatch(createAddAssetCommand(makeAsset(`a${String(index)}`)));
      }

      expect(store.getState().past).toHaveLength(HISTORY_LIMIT);
      expect(store.getState().project.assets).toHaveLength(HISTORY_LIMIT + 50);
    });
  });
});
