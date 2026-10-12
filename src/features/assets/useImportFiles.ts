import { useCallback, useState } from 'react';
import { createAddAssetCommand } from '@/core/commands/addAsset.ts';
import type { Asset } from '@/core/project.ts';
import { isSubtitleFileName } from '@/core/subtitles/srt.ts';
import { probeFile, UnsupportedMediaError } from '@/engine/media/probe.ts';
import { persistMedia } from '@/features/persistence/session.ts';
import { mediaStore } from '@/store/mediaStore.ts';
import { projectStore } from '@/store/projectStore.ts';
import { importSubtitleFile } from './importSubtitles.ts';

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
 * 파일을 순서대로 분석해 에셋으로 등록한다. SRT 자막은 에셋이 아니라 텍스트 트랙으로 바로 들어간다.
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
        if (isSubtitleFileName(file.name)) {
          const message = await importSubtitleFile(file);
          if (message) {
            setErrors((current) => [...current, { id, name: file.name, message }]);
          }
          continue;
        }
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
        if (projectStore.getState().dispatch(createAddAssetCommand(asset))) {
          // 원본은 바뀌지 않으므로 가져올 때 한 번만 저장한다 (Project는 자동 저장이 따로 저장)
          void persistMedia(id, file, result.thumbnail);
        }
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
