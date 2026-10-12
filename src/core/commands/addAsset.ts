import type { Asset } from '../project.ts';
import type { Command } from './command.ts';

export function createAddAssetCommand(asset: Asset): Command {
  return {
    label: '에셋 추가',
    execute(project) {
      if (project.assets.some((existing) => existing.id === asset.id)) {
        throw new Error(`Asset already exists: ${asset.id}`);
      }
      return { ...project, assets: [...project.assets, asset] };
    },
    undo(project) {
      return { ...project, assets: project.assets.filter((existing) => existing.id !== asset.id) };
    },
  };
}
