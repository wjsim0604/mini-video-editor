import { describe, expect, it } from 'vitest';
import { parsePersistedProject } from '@/core/persistence/persistedProject.ts';
import { createEmptyProject } from '@/core/project.ts';
import { createLocalStorageBackup } from './emergencyBackup.ts';

describe('createLocalStorageBackup', () => {
  it('동기적으로 쓰고 읽고 지운다', () => {
    localStorage.clear();
    const backup = createLocalStorageBackup(localStorage, () => 42);
    const project = createEmptyProject('p', '백업');

    backup.write(project);
    expect(backup.read()).toMatchObject({ savedAt: 42 });
    expect(parsePersistedProject(backup.read())).toEqual(project);

    backup.clear();
    expect(backup.read()).toBeNull();
  });

  it('저장소가 없거나 값이 JSON이 아니어도 예외를 던지지 않는다', () => {
    expect(createLocalStorageBackup(null).read()).toBeNull();
    localStorage.setItem('mini-video-editor:backup', '{broken');
    expect(createLocalStorageBackup(localStorage).read()).toBeNull();
  });
});
