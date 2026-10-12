import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Asset } from '../project.ts';
import { createAddAssetCommand } from './addAsset.ts';

const asset: Asset = {
  id: 'asset-1',
  type: 'video',
  name: 'clip.mp4',
  duration: 3_000_000,
  width: 1920,
  height: 1080,
};

describe('createAddAssetCommand', () => {
  it('에셋을 목록 끝에 추가한다', () => {
    const project = createEmptyProject('p', 'test');
    const other: Asset = { ...asset, id: 'asset-0' };
    const withOther = createAddAssetCommand(other).execute(project);

    const next = createAddAssetCommand(asset).execute(withOther);

    expect(next.assets).toEqual([other, asset]);
  });

  it('원본 Project를 변경하지 않는다', () => {
    const project = createEmptyProject('p', 'test');

    createAddAssetCommand(asset).execute(project);

    expect(project.assets).toEqual([]);
  });

  it('undo하면 추가 전 상태로 돌아간다', () => {
    const project = createEmptyProject('p', 'test');
    const command = createAddAssetCommand(asset);

    expect(command.undo(command.execute(project))).toEqual(project);
  });

  it('같은 id의 에셋을 중복 추가하면 에러를 던진다', () => {
    const command = createAddAssetCommand(asset);
    const project = command.execute(createEmptyProject('p', 'test'));

    expect(() => command.execute(project)).toThrow();
  });
});
