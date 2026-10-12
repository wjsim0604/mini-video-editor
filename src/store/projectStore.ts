import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { mergeCommands, type Command } from '@/core/commands/command.ts';
import { createEmptyProject, type Project } from '@/core/project.ts';

export interface ProjectState {
  project: Project;
  /** 실행된 커맨드 (마지막 요소가 가장 최근) */
  past: Command[];
  /** undo된 커맨드 (마지막 요소가 다음 redo 대상) */
  future: Command[];
  /** 마지막으로 실행한 커맨드의 mergeKey와 시각 (연속 편집 합치기용) */
  lastDispatch: { mergeKey: string; at: number } | null;
  /**
   * 편집 동작은 반드시 이 함수를 통해 실행한다.
   * 커맨드가 실패(예외)하면 Project와 히스토리를 바꾸지 않고 false를 반환한다.
   */
  dispatch: (command: Command) => boolean;
  /** 되돌릴 것이 없거나 실패하면 false */
  undo: () => boolean;
  /** 다시 실행할 것이 없거나 실패하면 false */
  redo: () => boolean;
  /**
   * 저장본 복원·새 프로젝트처럼 Project 전체를 교체한다. 편집이 아니므로 커맨드를 거치지 않고
   * 히스토리를 비운다 (이전 프로젝트의 커맨드로 새 프로젝트를 되돌릴 수 없도록).
   */
  loadProject: (project: Project) => void;
}

/** 같은 mergeKey의 커맨드가 이 시간 안에 이어지면 히스토리 한 항목으로 합친다 */
export const MERGE_WINDOW_MS = 1000;
/** 커맨드는 Project 일부를 붙잡고 있으므로 오래된 히스토리는 버린다 */
export const HISTORY_LIMIT = 200;

/** 커맨드 실행 결과. 실패하면 오류를 기록하고 null */
function tryRun(action: string, run: () => Project): Project | null {
  try {
    return run();
  } catch (error) {
    console.error(`Failed to ${action}`, error);
    return null;
  }
}

export function createProjectStore(
  initialProject: Project = createEmptyProject(crypto.randomUUID(), '새 프로젝트'),
  now: () => number = () => Date.now(),
) {
  return createStore<ProjectState>()((set, get) => ({
    project: initialProject,
    past: [],
    future: [],
    lastDispatch: null,
    dispatch: (command) => {
      const state = get();
      const project = tryRun(`execute "${command.label}"`, () => command.execute(state.project));
      if (!project) {
        return false;
      }
      const at = now();
      const previous = state.past.at(-1);
      const { lastDispatch } = state;
      const shouldMerge =
        previous !== undefined &&
        command.mergeKey !== undefined &&
        lastDispatch?.mergeKey === command.mergeKey &&
        at - lastDispatch.at <= MERGE_WINDOW_MS;
      const past = shouldMerge
        ? [...state.past.slice(0, -1), mergeCommands(previous, command)]
        : [...state.past, command];
      set({
        project,
        past: past.slice(-HISTORY_LIMIT),
        future: [],
        lastDispatch: command.mergeKey === undefined ? null : { mergeKey: command.mergeKey, at },
      });
      return true;
    },
    undo: () => {
      const state = get();
      const command = state.past.at(-1);
      if (!command) {
        return false;
      }
      const project = tryRun(`undo "${command.label}"`, () => command.undo(state.project));
      if (!project) {
        return false;
      }
      set({
        project,
        past: state.past.slice(0, -1),
        future: [...state.future, command],
        lastDispatch: null,
      });
      return true;
    },
    redo: () => {
      const state = get();
      const command = state.future.at(-1);
      if (!command) {
        return false;
      }
      const project = tryRun(`redo "${command.label}"`, () => command.execute(state.project));
      if (!project) {
        return false;
      }
      set({
        project,
        past: [...state.past, command].slice(-HISTORY_LIMIT),
        future: state.future.slice(0, -1),
        lastDispatch: null,
      });
      return true;
    },
    loadProject: (project) => {
      set({ project, past: [], future: [], lastDispatch: null });
    },
  }));
}

export const projectStore = createProjectStore();

export function useProjectStore<T>(selector: (state: ProjectState) => T): T {
  return useStore(projectStore, selector);
}
