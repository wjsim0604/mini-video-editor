import { Monitor } from 'lucide-react';
import { buildSetResolutionCommand } from '@/core/commands/setResolution.ts';
import { findPreset, RESOLUTION_PRESETS } from '@/core/resolution.ts';
import { projectStore, useProjectStore } from '@/store/projectStore.ts';

/** 헤더의 출력 해상도 선택. 바꾸면 텍스트·클립 배치가 새 화면의 같은 자리로 옮겨진다 (undo 가능) */
export function ResolutionSelect() {
  const width = useProjectStore((state) => state.project.width);
  const height = useProjectStore((state) => state.project.height);
  const preset = findPreset({ width, height });
  const customValue = `${String(width)}x${String(height)}`;

  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Monitor aria-hidden="true" className="size-4" />
      <span className="sr-only">출력 해상도</span>
      <select
        title={`출력 해상도 ${String(width)}×${String(height)}`}
        value={preset?.id ?? customValue}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        onChange={(event) => {
          const next = RESOLUTION_PRESETS.find((option) => option.id === event.target.value);
          if (!next) {
            return;
          }
          const { project, dispatch } = projectStore.getState();
          const command = buildSetResolutionCommand(project, next);
          if (command) {
            dispatch(command);
          }
        }}
      >
        {!preset && (
          <option value={customValue} disabled>
            {width}×{height}
          </option>
        )}
        {RESOLUTION_PRESETS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label} ({option.width}×{option.height})
          </option>
        ))}
      </select>
    </label>
  );
}
