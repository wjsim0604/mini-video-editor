import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { buildSetClipTransformCommand } from '@/core/commands/clipTransform.ts';
import { buildUpdateOverlayCommand } from '@/core/commands/overlay.ts';
import type { Command } from '@/core/commands/command.ts';
import { resolveLayers } from '@/core/composition.ts';
import type { Project } from '@/core/project.ts';
import { clipRect, defaultClipTransform, type Rect } from '@/core/render/fit.ts';
import { collectBoxSnapTargets, snapBox, type BoxSnapTargets } from '@/core/render/snapBox.ts';
import type { Microseconds } from '@/core/time.ts';
import { measureTextBox } from '@/engine/render/textLayout.ts';
import { usePlaybackStore } from '@/store/playbackStore.ts';
import { projectStore, useProjectStore } from '@/store/projectStore.ts';
import { timelineStore, useTimelineStore } from '@/store/timelineStore.ts';
import { playbackEngine } from './playback.ts';

interface PreviewItemHandlesProps {
  /** 프리뷰 캔버스의 화면 크기(CSS px) */
  width: number;
  height: number;
}

type ItemKind = 'text' | 'clip';

interface Position {
  x: number;
  y: number;
}

/** 프리뷰에서 조작할 수 있는 요소 하나 (출력 해상도 기준 영역) */
interface HandleItem {
  kind: ItemKind;
  id: string;
  label: string;
  box: Rect;
}

interface DragSession {
  kind: ItemKind;
  itemId: string;
  pointerId: number;
  startX: number;
  startY: number;
  /** 드래그 시작 시 요소 중심 (출력 해상도 기준) */
  origin: Position;
  /** 요소 크기. 이동 중에는 바뀌지 않는다 */
  size: { width: number; height: number };
  /** 화면 px → 출력 해상도 px 배율 */
  scale: number;
  targets: BoxSnapTargets;
  moved: boolean;
}

interface Draft extends Position {
  kind: ItemKind;
  itemId: string;
  /** 붙은 기준선 (출력 해상도 기준). 없으면 null */
  guideX: number | null;
  guideY: number | null;
}

/** 이 거리 이상 움직여야 드래그로 본다 */
const DRAG_THRESHOLD_PX = 3;
/** 기준선에 붙는 거리 (화면 px). 타임라인 스냅과 같다 */
const SNAP_THRESHOLD_PX = 8;

/** 요소를 position(중심)으로 옮긴 Project. 드래그 중 프리뷰 그리기에만 쓴다 */
function withPosition(
  project: Project,
  kind: ItemKind,
  itemId: string,
  position: Position,
): Project {
  if (kind === 'text') {
    return {
      ...project,
      overlays: project.overlays.map((overlay) =>
        overlay.id === itemId ? { ...overlay, style: { ...overlay.style, ...position } } : overlay,
      ),
    };
  }
  return {
    ...project,
    clips: project.clips.map((clip) =>
      clip.id === itemId
        ? {
            ...clip,
            transform: { ...(clip.transform ?? defaultClipTransform(project)), ...position },
          }
        : clip,
    ),
  };
}

/** time에 보이는 요소를 아래 레이어부터 위 레이어 순서로 (위 요소가 클릭을 먼저 받도록 DOM에서 뒤에 둔다) */
function itemsAt(project: Project, time: Microseconds): HandleItem[] {
  const assets = new Map(project.assets.map((asset) => [asset.id, asset]));
  return resolveLayers(project, time).map((layer) => {
    if (layer.kind === 'text') {
      return {
        kind: 'text',
        id: layer.overlay.id,
        label: `텍스트 상자 ${layer.overlay.text.split('\n')[0] ?? ''}`,
        box: measureTextBox(layer.overlay),
      };
    }
    const asset = assets.get(layer.assetId);
    return {
      kind: 'clip',
      id: layer.clipId,
      label: `클립 ${asset?.name ?? ''}`,
      box: clipRect(asset, project, layer.transform),
    };
  });
}

function buildMoveCommand(
  project: Project,
  kind: ItemKind,
  itemId: string,
  position: Position,
): Command | null {
  return kind === 'text'
    ? buildUpdateOverlayCommand(project, itemId, { style: position })
    : buildSetClipTransformCommand(project, itemId, position);
}

/**
 * 프리뷰 위에 현재 시각의 텍스트·클립 영역을 겹쳐 클릭 선택과 위치 드래그를 받는다.
 * 요소 자체는 캔버스에 그려지고, 이 레이어는 투명한 조작 영역과 선택 테두리·스냅 안내선만 그린다.
 * 재생 중에는 매 프레임 갱신을 피하기 위해 숨긴다.
 */
export function PreviewItemHandles({ width, height }: PreviewItemHandlesProps) {
  const project = useProjectStore((state) => state.project);
  // 재생 중에는 null로 고정되어 리렌더되지 않고, 정지 상태에서 탐색할 때만 바뀐다
  const pausedTime = usePlaybackStore((state) => (state.isPlaying ? null : state.currentTime));
  const selectedItemId = useTimelineStore((state) => state.selectedItemId);
  const session = useRef<DragSession | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const cancelDrag = () => {
    session.current = null;
    setDraft(null);
    timelineStore.getState().setPreviewDragging(false);
    playbackEngine.endPreview();
  };

  useEffect(() => {
    if (!draft) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        session.current = null;
        setDraft(null);
        timelineStore.getState().setPreviewDragging(false);
        playbackEngine.endPreview();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [draft]);

  if (pausedTime === null || width <= 0) {
    return null;
  }
  const scale = width / project.width;
  const items = itemsAt(
    draft ? withPosition(project, draft.kind, draft.itemId, draft) : project,
    pausedTime,
  );

  const guideX = draft?.guideX ?? null;
  const guideY = draft?.guideY ?? null;

  const onPointerDown = (event: PointerEvent<HTMLElement>, item: HandleItem) => {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    timelineStore.getState().selectItem(item.id);
    // 기준선: 화면 가장자리·중앙선 + 같은 시각에 보이는 다른 텍스트
    const otherTexts = items
      .filter((other) => other.kind === 'text' && other.id !== item.id)
      .map((other) => other.box);
    session.current = {
      kind: item.kind,
      itemId: item.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: item.box.x + item.box.width / 2, y: item.box.y + item.box.height / 2 },
      size: { width: item.box.width, height: item.box.height },
      scale,
      targets: collectBoxSnapTargets(project, otherTexts),
      moved: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = session.current;
    if (current?.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) {
      return;
    }
    if (!current.moved) {
      timelineStore.getState().setPreviewDragging(true);
    }
    current.moved = true;
    // 화면 이동량을 출력 해상도 기준 px로 바꾼다
    const desired = {
      x: current.origin.x + dx / current.scale,
      y: current.origin.y + dy / current.scale,
    };
    const { width: boxWidth, height: boxHeight } = current.size;
    const snap =
      timelineStore.getState().snapEnabled && !event.altKey
        ? snapBox(
            {
              x: desired.x - boxWidth / 2,
              y: desired.y - boxHeight / 2,
              width: boxWidth,
              height: boxHeight,
            },
            current.targets,
            SNAP_THRESHOLD_PX / current.scale,
          )
        : null;
    const position = {
      x: Math.round(desired.x + (snap?.dx ?? 0)),
      y: Math.round(desired.y + (snap?.dy ?? 0)),
    };
    setDraft({
      kind: current.kind,
      itemId: current.itemId,
      ...position,
      guideX: snap?.guideX ?? null,
      guideY: snap?.guideY ?? null,
    });
    const latest = projectStore.getState().project;
    playbackEngine.previewFrame(
      withPosition(latest, current.kind, current.itemId, position),
      pausedTime,
    );
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const current = session.current;
    if (current?.pointerId !== event.pointerId) {
      return;
    }
    const finalDraft = draft;
    cancelDrag();
    if (!current.moved || finalDraft?.itemId !== current.itemId) {
      return;
    }
    const { project: latest, dispatch } = projectStore.getState();
    const command = buildMoveCommand(latest, current.kind, current.itemId, {
      x: finalDraft.x,
      y: finalDraft.y,
    });
    if (command) {
      dispatch(command);
    }
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ width, height }}
      data-testid="preview-item-handles"
    >
      {items.map((item) => {
        const isSelected = item.id === selectedItemId;
        return (
          <div
            key={item.id}
            role="button"
            tabIndex={-1}
            aria-label={item.label}
            aria-pressed={isSelected}
            className={`pointer-events-auto absolute cursor-move touch-none border ${
              isSelected ? 'border-selection' : 'border-transparent hover:border-white/50'
            }`}
            style={{
              left: item.box.x * scale,
              top: item.box.y * scale,
              width: item.box.width * scale,
              height: item.box.height * scale,
            }}
            onPointerDown={(event) => {
              onPointerDown(event, item);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={cancelDrag}
          />
        );
      })}
      {guideX !== null && (
        <div
          data-testid="preview-snap-guide-x"
          aria-hidden="true"
          className="absolute inset-y-0 w-px bg-warning"
          style={{ left: Math.min(guideX * scale, width - 1) }}
        />
      )}
      {guideY !== null && (
        <div
          data-testid="preview-snap-guide-y"
          aria-hidden="true"
          className="absolute inset-x-0 h-px bg-warning"
          style={{ top: Math.min(guideY * scale, height - 1) }}
        />
      )}
    </div>
  );
}
