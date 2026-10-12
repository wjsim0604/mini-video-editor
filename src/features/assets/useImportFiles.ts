import { useCallback, useState } from 'react';
import { createAddAssetCommand } from '@/core/commands/addAsset.ts';
import type { Asset } from '@/core/project.ts';
import { probeFile, UnsupportedMediaError } from '@/engine/media/probe.ts';
import { mediaStore } from '@/store/mediaStore.ts';
import { projectStore } from '@/store/projectStore.ts';

export interface PendingImport {
  id: string;
  name: string;
}

export interface ImportError {
  id: string;
  name: string;
  message: string;
}

/**
 * 파일을 순서대로 분석해 에셋으로 등록한다.
 * 큰 영상을 동시에 디코딩하면 메모리를 많이 쓰므로 한 번에 하나씩 처리한다.
 */
export function useImportFiles() {
  const [pending, setPending] = useState<PendingImport[]>([]);
  const [errors, setErrors] = useState<ImportError[]>([]);

  const importFiles = useCallback(async (files: readonly File[]) => {
    const queue = files.map((file) => ({ id: crypto.randomUUID(), file }));
    setPending((current) => [
      ...current,
      ...queue.map(({ id, file }) => ({ id, name: file.name })),
    ]);

    for (const { id, file } of queue) {
      try {
        const result = await probeFile(file);
        const asset: Asset = {
          id,
          type: result.type,
          name: file.name,
          duration: result.duration,
          width: result.width,
          height: result.height,
        };
        mediaStore.getState().register(id, file, result.thumbnail);
        projectStore.getState().dispatch(createAddAssetCommand(asset));
      } catch (error) {
        const message =
          error instanceof UnsupportedMediaError ? error.message : '파일을 불러오지 못했습니다';
        if (!(error instanceof UnsupportedMediaError)) {
          console.error(error);
        }
        setErrors((current) => [...current, { id, name: file.name, message }]);
      } finally {
        setPending((current) => current.filter((item) => item.id !== id));
      }
    }
  }, []);

  const dismissError = useCallback((id: string) => {
    setErrors((current) => current.filter((item) => item.id !== id));
  }, []);

  return { pending, errors, importFiles, dismissError };
}
