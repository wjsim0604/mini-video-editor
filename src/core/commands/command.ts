import type { Project } from '../project.ts';

/**
 * 모든 편집 동작의 단위. Project를 직접 수정하지 않고 새 Project를 반환하는 순수 함수로 구성한다.
 * store는 dispatch 시 execute 결과를 반영하고 히스토리에 쌓아 undo/redo에 사용한다.
 */
export interface Command {
  /** 히스토리 표시용 이름 (예: "에셋 추가") */
  readonly label: string;
  execute(project: Project): Project;
  undo(project: Project): Project;
}
