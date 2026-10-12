import { describe, expect, it, vi } from 'vitest';
import { toPersisted } from '@/core/persistence/persistedProject.ts';
import { createEmptyProject, type Project } from '@/core/project.ts';
import { createMemoryRepository } from '@/lib/projectRepository.ts';
import { restoreSession } from './restore.ts';

function projectWithAssets(): Project {
  return {
    ...createEmptyProject('p', '복원'),
    assets: [
      { id: 'a', type: 'video', name: 'a.webm', duration: 3_000_000 },
      { id: 'b', type: 'image', name: 'b.png', duration: 5_000_000 },
    ],
  };
}

function media(assetId: string, name: string) {
  return {
    assetId,
    blob: new Blob(['data'], { type: 'video/webm' }),
    name,
    type: 'video/webm',
    thumbnail: new Blob(['thumb'], { type: 'image/jpeg' }),
  };
}

function setupDeps() {
  const repository = createMemoryRepository();
  const registered: { assetId: string; file: File }[] = [];
  const loaded: Project[] = [];
  return {
    repository,
    registered,
    loaded,
    deps: {
      repository,
      registerMedia: (assetId: string, file: File) => {
        registered.push({ assetId, file });
      },
      loadProject: (project: Project) => {
        loaded.push(project);
      },
    },
  };
}

describe('restoreSession', () => {
  it('저장본이 없으면 empty', async () => {
    const ctx = setupDeps();

    expect(await restoreSession(ctx.deps)).toEqual({ status: 'empty' });
    expect(ctx.loaded).toEqual([]);
  });

  it('Project와 원본 파일을 복원하고, 파일을 먼저 등록한다', async () => {
    const ctx = setupDeps();
    const project = projectWithAssets();
    await ctx.repository.saveProject(toPersisted(project, 1));
    await ctx.repository.saveMedia(media('a', 'a.webm'));
    await ctx.repository.saveMedia(media('b', 'b.png'));
    const order: string[] = [];
    const result = await restoreSession({
      ...ctx.deps,
      registerMedia: (assetId, file) => {
        order.push(`media:${assetId}`);
        ctx.deps.registerMedia(assetId, file);
      },
      loadProject: (loaded) => {
        order.push('project');
        ctx.deps.loadProject(loaded);
      },
    });

    expect(result).toEqual({ status: 'restored', project, missingAssetIds: [] });
    expect(order).toEqual(['media:a', 'media:b', 'project']);
    const file = ctx.registered[0]?.file;
    expect(file).toBeInstanceOf(File);
    expect(file?.name).toBe('a.webm');
    expect(file?.type).toBe('video/webm');
  });

  it('저장되지 않은 원본 파일은 missing으로 알려준다', async () => {
    const ctx = setupDeps();
    await ctx.repository.saveProject(toPersisted(projectWithAssets(), 1));
    await ctx.repository.saveMedia(media('a', 'a.webm'));

    const result = await restoreSession(ctx.deps);

    expect(result.status === 'restored' && result.missingAssetIds).toEqual(['b']);
  });

  it('Project가 참조하지 않는 원본 파일은 지운다', async () => {
    const ctx = setupDeps();
    await ctx.repository.saveProject(toPersisted(projectWithAssets(), 1));
    await ctx.repository.saveMedia(media('a', 'a.webm'));
    await ctx.repository.saveMedia(media('orphan', 'undone.webm'));

    await restoreSession(ctx.deps);

    expect([...ctx.repository.media.keys()]).toEqual(['a']);
  });

  it('형식이 깨진 저장본이면 invalid이고, 원본 파일은 지우지 않는다', async () => {
    const ctx = setupDeps();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const broken = { ...projectWithAssets(), fps: 'thirty' } as unknown as Project;
    await ctx.repository.saveProject(toPersisted(broken, 1));
    await ctx.repository.saveMedia(media('a', 'a.webm'));

    expect(await restoreSession(ctx.deps)).toEqual({ status: 'invalid' });
    expect(ctx.loaded).toEqual([]);
    expect(ctx.repository.media.size).toBe(1);
    warn.mockRestore();
  });

  describe('비상 백업', () => {
    function backupOf(value: unknown) {
      const clear = vi.fn();
      return { backup: { read: () => value, clear }, clear };
    }

    it('백업이 IndexedDB 저장본보다 최신이면 백업을 복원하고 IndexedDB에도 저장한다', async () => {
      const ctx = setupDeps();
      await ctx.repository.saveProject(toPersisted({ ...projectWithAssets(), name: '이전' }, 100));
      const { backup, clear } = backupOf(
        toPersisted({ ...projectWithAssets(), name: '마지막 편집' }, 200),
      );

      const result = await restoreSession({ ...ctx.deps, backup });

      expect(result.status === 'restored' && result.project.name).toBe('마지막 편집');
      expect(await ctx.repository.loadLastProject()).toMatchObject({
        project: { name: '마지막 편집' },
      });
      expect(clear).toHaveBeenCalled();
    });

    it('백업이 더 오래되었거나 깨졌으면 IndexedDB 저장본을 쓴다', async () => {
      const ctx = setupDeps();
      await ctx.repository.saveProject(toPersisted({ ...projectWithAssets(), name: '최신' }, 300));

      const older = await restoreSession({
        ...ctx.deps,
        backup: backupOf(toPersisted(projectWithAssets(), 1)).backup,
      });
      const broken = await restoreSession({
        ...ctx.deps,
        backup: backupOf({ schemaVersion: 1 }).backup,
      });

      expect(older.status === 'restored' && older.project.name).toBe('최신');
      expect(broken.status === 'restored' && broken.project.name).toBe('최신');
    });
  });
});
