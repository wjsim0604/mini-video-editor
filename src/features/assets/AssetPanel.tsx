import { CircleAlert, FileVideo, TriangleAlert, Upload, X } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { PanelHeader } from '@/components/PanelHeader.tsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.tsx';
import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils.ts';
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
      className={cn(
        'flex min-h-0 flex-col border-r bg-panel',
        isDragOver && 'bg-primary/10 outline-2 -outline-offset-2 outline-primary',
      )}
      onDragOver={handleDragOver}
      onDragLeave={() => {
        setIsDragOver(false);
      }}
      onDrop={handleDrop}
    >
      <PanelHeader title="에셋">
        <Button variant="secondary" size="xs" onClick={() => inputRef.current?.click()}>
          <Upload />
          가져오기
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          data-testid="asset-file-input"
          onChange={handleChange}
        />
      </PanelHeader>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {errors.length > 0 && (
          <ul aria-label="가져오기 알림" className="mb-1.5 space-y-1">
            {errors.map((error) => (
              <li key={error.id}>
                <Alert
                  variant={error.severity === 'error' ? 'destructive' : 'warning'}
                  className="relative px-3 py-2 pr-9 text-xs"
                >
                  {error.severity === 'error' ? <CircleAlert /> : <TriangleAlert />}
                  <AlertTitle className="truncate">{error.name}</AlertTitle>
                  <AlertDescription className="text-xs">{error.message}</AlertDescription>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`${error.name} 오류 닫기`}
                    className="absolute top-1.5 right-1.5"
                    onClick={() => {
                      dismissError(error.id);
                    }}
                  >
                    <X />
                  </Button>
                </Alert>
              </li>
            ))}
          </ul>
        )}

        {isEmpty ? (
          <div className="m-1.5 flex flex-col items-center gap-2 rounded-lg border border-dashed px-2 py-8 text-center text-xs leading-relaxed text-muted-foreground">
            <FileVideo aria-hidden="true" className="size-6" />
            <p>
              영상·이미지·SRT 자막을
              <br />
              여기에 끌어다 놓으세요
            </p>
          </div>
        ) : (
          <ul aria-label="에셋 목록" className="space-y-0.5">
            {assets.map((asset) => (
              <AssetItem key={asset.id} asset={asset} />
            ))}
            {pending.map((item) => (
              <li
                key={item.id}
                aria-busy="true"
                className="flex items-center gap-2 p-1.5 text-xs text-muted-foreground"
              >
                <div className="aspect-video w-20 shrink-0 animate-pulse rounded-md bg-muted" />
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
