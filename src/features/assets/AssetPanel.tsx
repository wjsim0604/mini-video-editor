import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useProjectStore } from '@/store/projectStore.ts';
import { AssetItem } from './AssetItem.tsx';
import { useImportFiles } from './useImportFiles.ts';

// .srt는 MIME 타입이 브라우저마다 달라 확장자로 받는다
const ACCEPT = 'video/*,image/*,.srt';

export function AssetPanel() {
  const assets = useProjectStore((state) => state.project.assets);
  const { pending, errors, importFiles, dismissError } = useImportFiles();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      void importFiles(Array.from(files));
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
    // 같은 파일을 다시 선택해도 change 이벤트가 발생하도록 초기화
    event.target.value = '';
  };

  const handleDragOver = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes('Files')) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    handleFiles(event.dataTransfer.files);
  };

  const isEmpty = assets.length === 0 && pending.length === 0;

  return (
    <section
      aria-label="에셋"
      className={`flex min-h-0 flex-col border-r border-neutral-800 ${isDragOver ? 'bg-sky-950/40 outline-2 -outline-offset-2 outline-sky-500' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={() => {
        setIsDragOver(false);
      }}
      onDrop={handleDrop}
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-800 px-3">
        <h2 className="text-xs font-semibold text-neutral-300">에셋</h2>
        <button
          type="button"
          className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
          onClick={() => inputRef.current?.click()}
        >
          가져오기
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          data-testid="asset-file-input"
          onChange={handleChange}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {errors.length > 0 && (
          <ul aria-label="가져오기 오류" className="mb-1.5 space-y-1">
            {errors.map((error) => (
              <li
                key={error.id}
                role="alert"
                className="flex items-start gap-2 rounded bg-red-950/60 p-1.5 text-xs text-red-200"
              >
                <p className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{error.name}</span>
                  {error.message}
                </p>
                <button
                  type="button"
                  aria-label={`${error.name} 오류 닫기`}
                  className="px-1 text-red-300 hover:text-red-100"
                  onClick={() => {
                    dismissError(error.id);
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {isEmpty ? (
          <p className="px-2 py-8 text-center text-xs leading-relaxed text-neutral-500">
            영상·이미지·SRT 자막을
            <br />
            여기에 끌어다 놓으세요
          </p>
        ) : (
          <ul aria-label="에셋 목록" className="space-y-0.5">
            {assets.map((asset) => (
              <AssetItem key={asset.id} asset={asset} />
            ))}
            {pending.map((item) => (
              <li
                key={item.id}
                aria-busy="true"
                className="flex items-center gap-2 p-1.5 text-xs text-neutral-400"
              >
                <div className="aspect-video w-20 shrink-0 animate-pulse rounded bg-neutral-800" />
                <p className="min-w-0">
                  <span className="block truncate">{item.name}</span>
                  불러오는 중…
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
