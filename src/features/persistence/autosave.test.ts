import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parsePersistedProject } from '@/core/persistence/persistedProject.ts';
import { createEmptyProject, type Project } from '@/core/project.ts';
import { createMemoryRepository } from '@/lib/projectRepository.ts';
import type { SaveStatus } from '@/store/saveStatusStore.ts';
import { createAutosave } from './autosave.ts';

/** Project를 바꾸면 구독자에게 알리는 최소한의 store */
function setup(repository = createMemoryRepository()) {
  let project: Project = createEmptyProject('p', '처음');
  const listeners = new Set<() => void>();
  const statuses: SaveStatus['state'][] = [];
  const autosave = createAutosave({
    repository,
    getProject: () => project,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onStatus: (status) => statuses.push(status.state),
    debounceMs: 500,
    now: () => 1000,
  });
  return {
    repository,
    autosave,
    statuses,
    rename: (name: string) => {
      project = { ...project, name };
      listeners.forEach((listener) => {
        listener();
      });
    },
    savedName: async () => parsePersistedProject(await repository.loadLastProject())?.name,
  };
}

describe('createAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('연속 편집은 마지막 편집 500ms 뒤 한 번만 저장한다', async () => {
    const ctx = setup();
    const save = vi.spyOn(ctx.repository, 'saveProject');

    ctx.rename('a');
    await vi.advanceTimersByTimeAsync(300);
    ctx.rename('ab');
    await vi.advanceTimersByTimeAsync(300);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    expect(save).toHaveBeenCalledOnce();
    expect(await ctx.savedName()).toBe('ab');
    expect(ctx.statuses).toEqual(['saving', 'saved']);
  });

  it('flush는 대기 중인 저장을 즉시 실행하고, 바뀐 것이 없으면 저장하지 않는다', async () => {
    const ctx = setup();
    const save = vi.spyOn(ctx.repository, 'saveProject');

    ctx.rename('즉시');
    await ctx.autosave.flush();
    expect(await ctx.savedName()).toBe('즉시');

    await ctx.autosave.flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledOnce();
  });

  it('저장에 실패하면 오류 상태를 알리고 다음 편집 때 다시 저장한다', async () => {
    const ctx = setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(ctx.repository, 'saveProject').mockRejectedValueOnce(
      new DOMException('full', 'QuotaExceededError'),
    );

    ctx.rename('실패');
    await ctx.autosave.flush();
    expect(ctx.statuses.at(-1)).toBe('error');

    ctx.rename('성공');
    await ctx.autosave.flush();
    expect(ctx.statuses.at(-1)).toBe('saved');
    expect(await ctx.savedName()).toBe('성공');
    consoleError.mockRestore();
  });

  it('dispose 후에는 저장하지 않는다', async () => {
    const ctx = setup();
    const save = vi.spyOn(ctx.repository, 'saveProject');

    ctx.rename('a');
    ctx.autosave.dispose();
    await vi.advanceTimersByTimeAsync(1000);

    expect(save).not.toHaveBeenCalled();
  });
});
