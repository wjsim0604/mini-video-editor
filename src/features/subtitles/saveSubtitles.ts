import { exportFileName } from '@/core/export/exportPlan.ts';
import { serializeSrt } from '@/core/subtitles/srt.ts';
import { subtitleCuesFromProject } from '@/core/subtitles/subtitles.ts';
import { downloadBlob } from '@/lib/download.ts';
import { projectStore } from '@/store/projectStore.ts';

/** 프로젝트의 모든 텍스트를 SRT 파일로 내려받는다. 저장할 텍스트가 없으면 false */
export function saveSubtitlesAsSrt(): boolean {
  const { project } = projectStore.getState();
  const cues = subtitleCuesFromProject(project);
  if (cues.length === 0) {
    return false;
  }
  // 메모장 등에서 한글이 깨지지 않도록 UTF-8 BOM을 붙인다
  const blob = new Blob(['\uFEFF', serializeSrt(cues)], { type: 'application/x-subrip' });
  downloadBlob(blob, exportFileName(project.name, 'srt'));
  return true;
}
