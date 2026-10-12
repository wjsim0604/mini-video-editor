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
  /** 편집 동작은 반드시 이 함수를 통해 실행한다 */
  dispatch: (command: Command) => void;
  undo: () => void;
  redo: () => void;
}

/** 같은 mergeKey의 커맨드가 이 시간 안에 이어지면 히스토리 한 항목으로 합친다 */
export const MERGE_WINDOW_MS = 1000;

export function createProjectStore(
  initialProject: Project = createEmptyProject(crypto.randomUUID(), '새 프로젝트'),
  now: () => number = () => Date.now(),
) {
  return createStore<ProjectState>()((set) => ({
    project: initialProject,
    past: [],
    future: [],
    lastDispatch: null,
    dispatch: (command) => {
      set((state) => {
        const at = now();
        const previous = state.past.at(-1);
        const { lastDispatch } = state;
        const shouldMerge =
          previous !== undefined &&
          command.mergeKey !== undefined &&
          lastDispatch?.mergeKey === command.mergeKey &&
          at - lastDispatch.at <= MERGE_WINDOW_MS;
        return {
          project: command.execute(state.project),
          past: shouldMerge
            ? [...state.past.slice(0, -1), mergeCommands(previous, command)]
            : [...state.past, command],
          future: [],
          lastDispatch: command.mergeKey === undefined ? null : { mergeKey: command.mergeKey, at },
        };
      });
    },
    undo: () => {
      set((state) => {
        const command = state.past.at(-1);
        if (!command) {
          return state;
        }
        return {
          project: command.undo(state.project),
          past: state.past.slice(0, -1),
          future: [...state.future, command],
          lastDispatch: null,
        };
      });
    },
    redo: () => {
      set((state) => {
        const command = state.future.at(-1);
        if (!command) {
          return state;
        }
        return {
          project: command.execute(state.project),
          past: [...state.past, command],
          future: state.future.slice(0, -1),
          lastDispatch: null,
        };
      });
    },
  }));
}

export const projectStore = createProjectStore();

export function useProjectStore<T>(selector: (state: ProjectState) => T): T {
  return useStore(projectStore, selector);
}
