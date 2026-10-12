import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { buildUpdateOverlayCommand } from '@/core/commands/overlay.ts';
import type { Project, TextOverlay } from '@/core/project.ts';
import { measureTextBox } from '@/engine/render/textLayout.ts';
import { usePlaybackStore } from '@/store/playbackStore.ts';
import { projectStore, useProjectStore } from '@/store/projectStore.ts';
import { timelineStore, useTimelineStore } from '@/store/timelineStore.ts';
import { playbackEngine } from './playback.ts';

interface TextOverlayHandlesProps {
  /** 프리뷰 캔버스의 화면 크기(CSS px) */
  width: number;
  height: number;
}

interface DragSession {
  overlayId: string;
  pointerId: number;
  startX: number;
  startY: number;
  origin: { x: number; y: number };
  /** 화면 px → 출력 해상도 px 배율 */
  scale: number;
  moved: boolean;
}

/** 이 거리 이상 움직여야 드래그로 본다 */
const DRAG_THRESHOLD_PX = 3;

function withPosition(
  project: Project,
  overlayId: string,
  position: { x: number; y: number },
): Project {
  return {
    ...project,
    overlays: project.overlays.map((overlay) =>
      overlay.id === overlayId ? { ...overlay, style: { ...overlay.style, ...position } } : overlay,
    ),
  };
}

/**
 * 프리뷰 위에 현재 시각의 텍스트 영역을 겹쳐 클릭 선택과 위치 드래그를 받는다.
 * 텍스트 자체는 캔버스에 그려지고, 이 레이어는 투명한 조작 영역과 선택 테두리만 그린다.
 * 재생 중에는 매 프레임 갱신을 피하기 위해 숨긴다.
 */
export function TextOverlayHandles({ width, height }: TextOverlayHandlesProps) {
  const project = useProjectStore((state) => state.project);
  // 재생 중에는 null로 고정되어 리렌더되지 않고, 정지 상태에서 탐색할 때만 바뀐다
  const pausedTime = usePlaybackStore((state) => (state.isPlaying ? null : state.currentTime));
  const selectedItemId = useTimelineStore((state) => state.selectedItemId);
  const session = useRef<DragSession | null>(null);
  const [draft, setDraft] = useState<{ overlayId: string; x: number; y: number } | null>(null);

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
  const visible = project.overlays.filter(
    (overlay) => overlay.start <= pausedTime && pausedTime < overlay.start + overlay.duration,
  );

  const onPointerDown = (event: PointerEvent<HTMLElement>, overlay: TextOverlay) => {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    timelineStore.getState().selectItem(overlay.id);
    session.current = {
      overlayId: overlay.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: overlay.style.x, y: overlay.style.y },
      scale,
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
    const position = {
      x: Math.round(current.origin.x + dx / current.scale),
      y: Math.round(current.origin.y + dy / current.scale),
    };
    setDraft({ overlayId: current.overlayId, ...position });
    const latest = projectStore.getState().project;
    playbackEngine.previewFrame(withPosition(latest, current.overlayId, position), pausedTime);
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const current = session.current;
    if (current?.pointerId !== event.pointerId) {
      return;
    }
    const finalDraft = draft;
    cancelDrag();
    if (!current.moved || finalDraft?.overlayId !== current.overlayId) {
      return;
    }
    const { project: latest, dispatch } = projectStore.getState();
    const command = buildUpdateOverlayCommand(latest, current.overlayId, {
      style: { x: finalDraft.x, y: finalDraft.y },
    });
    if (command) {
      dispatch(command);
    }
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ width, height }}
      data-testid="text-overlay-handles"
    >
      {visible.map((overlay) => {
        const position = draft?.overlayId === overlay.id ? draft : overlay.style;
        const box = measureTextBox({ ...overlay, style: { ...overlay.style, ...position } });
        const isSelected = overlay.id === selectedItemId;
        return (
          <div
            key={overlay.id}
            role="button"
            tabIndex={-1}
            aria-label={`텍스트 상자 ${overlay.text.split('\n')[0] ?? ''}`}
            aria-pressed={isSelected}
            className={`pointer-events-auto absolute cursor-move touch-none border ${
              isSelected ? 'border-selection' : 'border-transparent hover:border-white/50'
            }`}
            style={{
              left: box.x * scale,
              top: box.y * scale,
              width: box.width * scale,
              height: box.height * scale,
            }}
            onPointerDown={(event) => {
              onPointerDown(event, overlay);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={cancelDrag}
          />
        );
      })}
    </div>
  );
}
