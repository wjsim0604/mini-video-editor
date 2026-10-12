import type { Project } from '../project.ts';

/**
 * 모든 편집 동작의 단위. Project를 직접 수정하지 않고 새 Project를 반환하는 순수 함수로 구성한다.
 * store는 dispatch 시 execute 결과를 반영하고 히스토리에 쌓아 undo/redo에 사용한다.
 */
export interface Command {
  /** 히스토리 표시용 이름 (예: "에셋 추가") */
  readonly label: string;
  /**
   * 같은 대상의 연속 편집(예: 텍스트 입력, 슬라이더)을 히스토리 한 항목으로 합치기 위한 키.
   * 같은 키의 커맨드가 짧은 시간 안에 이어지면 store가 직전 항목과 합친다.
   */
  readonly mergeKey?: string;
  execute(project: Project): Project;
  undo(project: Project): Project;
}

/**
 * 연속된 두 커맨드를 하나로 합친다. 실행은 newer, 되돌리기는 older(처음 상태로 복원)를 쓴다.
 * 두 커맨드가 같은 대상의 같은 필드를 바꾸는 경우(같은 mergeKey)에만 올바르다.
 */
export function mergeCommands(older: Command, newer: Command): Command {
  return {
    label: newer.label,
    ...(newer.mergeKey === undefined ? {} : { mergeKey: newer.mergeKey }),
    execute: (project) => newer.execute(project),
    undo: (project) => older.undo(project),
  };
}
