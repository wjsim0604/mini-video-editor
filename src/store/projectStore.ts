import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { Command } from '@/core/commands/command.ts';
import { createEmptyProject, type Project } from '@/core/project.ts';

export interface ProjectState {
  project: Project;
  /** 실행된 커맨드 (마지막 요소가 가장 최근) */
  past: Command[];
  /** undo된 커맨드 (마지막 요소가 다음 redo 대상) */
  future: Command[];
  /** 편집 동작은 반드시 이 함수를 통해 실행한다 */
  dispatch: (command: Command) => void;
  undo: () => void;
  redo: () => void;
}

export function createProjectStore(
  initialProject: Project = createEmptyProject(crypto.randomUUID(), '새 프로젝트'),
) {
  return createStore<ProjectState>()((set) => ({
    project: initialProject,
    past: [],
    future: [],
    dispatch: (command) => {
      set((state) => ({
        project: command.execute(state.project),
        past: [...state.past, command],
        future: [],
      }));
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
        };
      });
    },
  }));
}

export const projectStore = createProjectStore();

export function useProjectStore<T>(selector: (state: ProjectState) => T): T {
  return useStore(projectStore, selector);
}
