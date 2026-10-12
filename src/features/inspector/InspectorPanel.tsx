import { useId, type ReactNode } from 'react';
import { buildUpdateOverlayCommand, type OverlayPatch } from '@/core/commands/overlay.ts';
import type { TextOverlay } from '@/core/project.ts';
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
      className="flex min-h-0 flex-col overflow-y-auto border-l border-neutral-800"
    >
      <div className="flex h-10 shrink-0 items-center border-b border-neutral-800 px-3">
        <h2 className="text-xs font-semibold text-neutral-300">인스펙터</h2>
      </div>
      <div className="space-y-4 p-3 text-xs">
        {!item && <p className="py-8 text-center text-neutral-500">편집할 항목을 선택하세요</p>}
        {item && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-neutral-400">
            <dt>종류</dt>
            <dd className="text-neutral-200">
              {item.kind === 'text' ? '텍스트' : (assetName ?? '클립')}
            </dd>
            <dt>시작</dt>
            <dd className="font-mono text-neutral-200">{formatTimecode(item.start, fps)}</dd>
            <dt>길이</dt>
            <dd className="font-mono text-neutral-200">
              {formatTimecode(item.end - item.start, fps)}
            </dd>
          </dl>
        )}
        {item?.kind === 'text' && <TextInspector overlay={item.overlay} />}
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
    <div className="space-y-3">
      <Field label="내용">
        {(id) => (
          <textarea
            id={id}
            rows={3}
            value={overlay.text}
            className="w-full resize-y rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-neutral-100"
            onChange={(event) => {
              update(overlay.id, { text: event.target.value });
            }}
          />
        )}
      </Field>
      <Field label="글자 크기">
        {(id) => (
          <div className="flex items-center gap-2">
            <input
              id={id}
              type="range"
              min={12}
              max={300}
              value={style.fontSize}
              className="min-w-0 flex-1 accent-neutral-300"
              onChange={(event) => {
                update(overlay.id, { style: { fontSize: Number(event.target.value) } });
              }}
            />
            <NumberInput
              label="글자 크기 값"
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
        {(id) => (
          <input
            id={id}
            type="color"
            value={style.color}
            className="h-7 w-full cursor-pointer rounded border border-neutral-700 bg-neutral-900"
            onChange={(event) => {
              update(overlay.id, { style: { color: event.target.value } });
            }}
          />
        )}
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="X">
          {(id) => (
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
          {(id) => (
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

function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-neutral-400">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

/** 숫자가 아닌 입력(빈칸, '-' 등 입력 중 상태)은 무시하고 유효한 정수만 반영한다 */
function NumberInput(props: {
  id?: string;
  label: string;
  value: number;
  min?: number;
  onCommit: (value: number) => void;
}) {
  return (
    <input
      {...(props.id === undefined ? { 'aria-label': props.label } : { id: props.id })}
      type="number"
      value={Math.round(props.value)}
      {...(props.min === undefined ? {} : { min: props.min })}
      className="w-16 rounded border border-neutral-700 bg-neutral-900 px-1.5 py-1 text-right text-neutral-100 tabular-nums"
      onChange={(event) => {
        const next = event.target.valueAsNumber;
        if (Number.isFinite(next) && (props.min === undefined || next >= props.min)) {
          props.onCommit(Math.round(next));
        }
      }}
    />
  );
}
