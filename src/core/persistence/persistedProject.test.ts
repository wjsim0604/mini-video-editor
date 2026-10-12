import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Project } from '../project.ts';
import {
  parsePersistedProject,
  pickLatestRecord,
  SCHEMA_VERSION,
  toPersisted,
} from './persistedProject.ts';

const S = 1_000_000;

function sampleProject(): Project {
  const base = createEmptyProject('p', '테스트');
  const videoTrack = base.tracks[0]?.id ?? '';
  return {
    ...base,
    tracks: [...base.tracks, { id: 't1', kind: 'text', order: 1 }],
    assets: [{ id: 'a', type: 'video', name: 'a.mp4', duration: 4 * S, width: 1280, height: 720 }],
    clips: [{ id: 'c', assetId: 'a', trackId: videoTrack, start: 0, inPoint: S, outPoint: 3 * S }],
    overlays: [
      {
        id: 'x',
        trackId: 't1',
        start: 0,
        duration: 2 * S,
        text: '안녕\n하세요',
        style: { fontSize: 72, color: '#ffffff', x: 960, y: 540 },
      },
    ],
  };
}

/** 저장본의 project 일부를 망가뜨린다 */
function corrupt(mutate: (project: Record<string, unknown>) => void): unknown {
  const persisted = structuredClone(toPersisted(sampleProject(), 1)) as unknown as {
    project: Record<string, unknown>;
  };
  mutate(persisted.project);
  return persisted;
}

describe('parsePersistedProject', () => {
  it('저장한 Project를 그대로 읽는다 (structuredClone 왕복)', () => {
    const project = sampleProject();
    const stored = structuredClone(toPersisted(project, 123));

    expect(stored.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsePersistedProject(stored)).toEqual(project);
  });

  it('클립의 위치·크기(transform)를 함께 읽는다', () => {
    const base = sampleProject();
    const project = {
      ...base,
      clips: base.clips.map((clip) => ({ ...clip, transform: { x: 100, y: 200, scale: 0.5 } })),
    };

    expect(parsePersistedProject(structuredClone(toPersisted(project, 1)))).toEqual(project);
  });

  it('객체가 아니거나 버전이 없으면 null', () => {
    expect(parsePersistedProject(null)).toBeNull();
    expect(parsePersistedProject('project')).toBeNull();
    expect(parsePersistedProject({ project: sampleProject() })).toBeNull();
  });

  it('알 수 없는(더 새로운) 버전이면 null', () => {
    expect(
      parsePersistedProject({ ...toPersisted(sampleProject(), 1), schemaVersion: 99 }),
    ).toBeNull();
  });

  it.each([
    [
      '필드 누락',
      (p: Record<string, unknown>) => {
        delete p['fps'];
      },
    ],
    [
      '트랙 종류 오류',
      (p: Record<string, unknown>) => {
        p['tracks'] = [{ id: 'v', kind: 'subtitle', order: 0 }];
      },
    ],
    [
      '정수가 아닌 시간',
      (p: Record<string, unknown>) => {
        p['clips'] = [
          { id: 'c', assetId: 'a', trackId: 't1', start: 0.5, inPoint: 0, outPoint: S },
        ];
      },
    ],
    [
      '없는 에셋을 가리키는 클립',
      (p: Record<string, unknown>) => {
        (p['clips'] as Record<string, unknown>[])[0] = {
          id: 'c',
          assetId: 'missing',
          trackId: 't1',
          start: 0,
          inPoint: 0,
          outPoint: S,
        };
      },
    ],
    [
      '없는 트랙을 가리키는 텍스트',
      (p: Record<string, unknown>) => {
        (p['overlays'] as Record<string, unknown>[])[0] = {
          id: 'x',
          trackId: 'missing',
          start: 0,
          duration: S,
          text: 'x',
          style: { fontSize: 72, color: '#fff', x: 0, y: 0 },
        };
      },
    ],
    [
      '잘못된 글자 크기',
      (p: Record<string, unknown>) => {
        const overlay = (p['overlays'] as { style: Record<string, unknown> }[])[0];
        if (overlay) {
          overlay.style['fontSize'] = 0;
        }
      },
    ],
    [
      '잘못된 클립 배율',
      (p: Record<string, unknown>) => {
        const clip = (p['clips'] as Record<string, unknown>[])[0];
        if (clip) {
          clip['transform'] = { x: 0, y: 0, scale: 0 };
        }
      },
    ],
  ])('%s → null', (_, mutate) => {
    expect(parsePersistedProject(corrupt(mutate))).toBeNull();
  });
});

describe('pickLatestRecord', () => {
  it('유효한 저장본 중 가장 최근 것을 고른다', () => {
    const older = toPersisted({ ...sampleProject(), name: '이전' }, 100);
    const newer = toPersisted({ ...sampleProject(), name: '최신' }, 200);

    expect(pickLatestRecord([older, newer])).toMatchObject({ savedAt: 200, index: 1 });
    expect(pickLatestRecord([newer, older])?.project.name).toBe('최신');
  });

  it('깨진 저장본은 건너뛰고, 모두 없으면 null', () => {
    const valid = toPersisted(sampleProject(), 100);

    expect(pickLatestRecord([null, { schemaVersion: 1, savedAt: 999 }, valid])?.index).toBe(2);
    expect(pickLatestRecord([null, 'x'])).toBeNull();
  });
});
