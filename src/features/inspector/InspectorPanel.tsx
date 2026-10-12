import { Film, MousePointerClick, RotateCcw, Type } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { PanelHeader } from '@/components/PanelHeader.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Slider } from '@/components/ui/slider.tsx';
import { Textarea } from '@/components/ui/textarea.tsx';
import { cn } from '@/lib/utils.ts';
import { buildSetClipTransformCommand } from '@/core/commands/clipTransform.ts';
import { buildUpdateOverlayCommand, type OverlayPatch } from '@/core/commands/overlay.ts';
import type { Clip, ClipTransform, TextOverlay } from '@/core/project.ts';
import { defaultClipTransform } from '@/core/render/fit.ts';
import { findItem } from '@/core/timelineItem.ts';
import { formatTimecode } from '@/core/time.ts';
import { projectStore, useProjectStore } from '@/store/projectStore.ts';
import { useTimelineStore } from '@/store/timelineStore.ts';

/** 선택한 항목의 속성을 보여주고 편집한다 */
export function InspectorPanel() {
  const selectedItemId = useTimelineStore((state) => state.selectedItemId);
  const item = useProjectStore((state) => findItem(state.project, selectedItemId));
  const assetName = useProjectStore((state) =>
    item?.kind === 'clip'
      ? state.project.assets.find((asset) => asset.id === item.clip.assetId)?.name
      : undefined,
  );
  const fps = useProjectStore((state) => state.project.fps);

  return (
    <section
      aria-label="인스펙터"
      className="flex min-h-0 flex-col overflow-y-auto border-l bg-panel"
    >
      <PanelHeader title="인스펙터" />
      <div className="space-y-4 p-3 text-xs">
        {!item && (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <MousePointerClick aria-hidden="true" className="size-5" />
            편집할 항목을 선택하세요
          </div>
        )}
        {item && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-md border bg-card/50 p-2.5 text-muted-foreground">
            <dt>종류</dt>
            <dd className="flex items-center gap-1.5 text-foreground">
              {item.kind === 'text' ? (
                <Type aria-hidden="true" className="size-3.5 text-text-item-border" />
              ) : (
                <Film aria-hidden="true" className="size-3.5 text-clip-border" />
              )}
              <span className="truncate">
                {item.kind === 'text' ? '텍스트' : (assetName ?? '클립')}
              </span>
            </dd>
            <dt>시작</dt>
            <dd className="font-mono text-foreground">{formatTimecode(item.start, fps)}</dd>
            <dt>길이</dt>
            <dd className="font-mono text-foreground">
              {formatTimecode(item.end - item.start, fps)}
            </dd>
          </dl>
        )}
        {item?.kind === 'text' && <TextInspector overlay={item.overlay} />}
        {item?.kind === 'clip' && <ClipInspector clip={item.clip} />}
      </div>
    </section>
  );
}

function update(overlayId: string, patch: OverlayPatch) {
  const { project, dispatch } = projectStore.getState();
  const command = buildUpdateOverlayCommand(project, overlayId, patch);
  if (command) {
    dispatch(command);
  }
}

/** 텍스트 스타일 편집. 같은 필드를 연속으로 바꾸면 히스토리 한 항목으로 합쳐진다(mergeKey) */
function TextInspector({ overlay }: { overlay: TextOverlay }) {
  const { style } = overlay;

  return (
    <div className="space-y-4">
      <Field label="내용">
        {({ id }) => (
          <Textarea
            id={id}
            rows={3}
            value={overlay.text}
            className="min-h-16 resize-y text-xs md:text-xs"
            onChange={(event) => {
              update(overlay.id, { text: event.target.value });
            }}
          />
        )}
      </Field>
      <Field label="글자 크기">
        {({ labelId }) => (
          <div className="flex items-center gap-3">
            <Slider
              aria-labelledby={labelId}
              min={12}
              max={300}
              step={1}
              value={[style.fontSize]}
              className="min-w-0 flex-1"
              onValueChange={([fontSize]) => {
                if (fontSize !== undefined) {
                  update(overlay.id, { style: { fontSize } });
                }
              }}
            />
            <NumberInput
              label="글자 크기 값"
              className="w-16"
              value={style.fontSize}
              min={1}
              onCommit={(fontSize) => {
                update(overlay.id, { style: { fontSize } });
              }}
            />
          </div>
        )}
      </Field>
      <Field label="색상">
        {({ id }) => (
          <div className="flex items-center gap-2">
            <Input
              id={id}
              type="color"
              value={style.color}
              className="h-8 w-12 cursor-pointer p-1"
              onChange={(event) => {
                update(overlay.id, { style: { color: event.target.value } });
              }}
            />
            <span className="font-mono text-muted-foreground uppercase">{style.color}</span>
          </div>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="X">
          {({ id }) => (
            <NumberInput
              id={id}
              label="X"
              value={style.x}
              onCommit={(x) => {
                update(overlay.id, { style: { x, y: style.y } });
              }}
            />
          )}
        </Field>
        <Field label="Y">
          {({ id }) => (
            <NumberInput
              id={id}
              label="Y"
              value={style.y}
              onCommit={(y) => {
                update(overlay.id, { style: { x: style.x, y } });
              }}
            />
          )}
        </Field>
      </div>
    </div>
  );
}

function updateClip(clipId: string, patch: Partial<ClipTransform> | null) {
  const { project, dispatch } = projectStore.getState();
  const command = buildSetClipTransformCommand(project, clipId, patch);
  if (command) {
    dispatch(command);
  }
}

/** 클립 위치·크기 편집. 크기는 화면에 꽉 맞춘 크기 대비 % */
function ClipInspector({ clip }: { clip: Clip }) {
  const width = useProjectStore((state) => state.project.width);
  const height = useProjectStore((state) => state.project.height);
  const transform = clip.transform ?? defaultClipTransform({ width, height });
  const percent = Math.round(transform.scale * 100);

  return (
    <div className="space-y-4">
      <Field label="크기 (%)">
        {({ labelId }) => (
          <div className="flex items-center gap-3">
            <Slider
              aria-labelledby={labelId}
              min={10}
              max={400}
              step={1}
              value={[percent]}
              className="min-w-0 flex-1"
              onValueChange={([value]) => {
                if (value !== undefined) {
                  updateClip(clip.id, { scale: value / 100 });
                }
              }}
            />
            <NumberInput
              label="크기 값"
              className="w-16"
              value={percent}
              min={1}
              onCommit={(value) => {
                updateClip(clip.id, { scale: value / 100 });
              }}
            />
          </div>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="X">
          {({ id }) => (
            <NumberInput
              id={id}
              label="X"
              value={transform.x}
              onCommit={(x) => {
                updateClip(clip.id, { x, y: transform.y });
              }}
            />
          )}
        </Field>
        <Field label="Y">
          {({ id }) => (
            <NumberInput
              id={id}
              label="Y"
              value={transform.y}
              onCommit={(y) => {
                updateClip(clip.id, { x: transform.x, y });
              }}
            />
          )}
        </Field>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={!clip.transform}
        onClick={() => {
          updateClip(clip.id, null);
        }}
      >
        <RotateCcw aria-hidden="true" />
        원위치
      </Button>
    </div>
  );
}

/** 라벨과 입력 묶음. 네이티브 입력은 id(htmlFor)로, Radix 슬라이더처럼 label을 쓸 수 없는 컨트롤은 labelId로 연결한다 */
function Field({
  label,
  children,
}: {
  label: string;
  children: (ids: { id: string; labelId: string }) => ReactNode;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  return (
    <div className="space-y-1.5">
      <Label id={labelId} htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      {children({ id, labelId })}
    </div>
  );
}

/** 숫자가 아닌 입력(빈칸, '-' 등 입력 중 상태)은 무시하고 유효한 정수만 반영한다 */
function NumberInput(props: {
  id?: string;
  label: string;
  value: number;
  min?: number;
  className?: string;
  onCommit: (value: number) => void;
}) {
  return (
    <Input
      {...(props.id === undefined ? { 'aria-label': props.label } : { id: props.id })}
      type="number"
      value={Math.round(props.value)}
      {...(props.min === undefined ? {} : { min: props.min })}
      className={cn('h-8 text-right text-xs tabular-nums md:text-xs', props.className)}
      onChange={(event) => {
        const next = event.target.valueAsNumber;
        if (Number.isFinite(next) && (props.min === undefined || next >= props.min)) {
          props.onCommit(Math.round(next));
        }
      }}
    />
  );
}
