import { parseSrt } from '@/core/subtitles/srt.ts';
import { createImportSubtitlesCommand, planSubtitleImport } from '@/core/subtitles/subtitles.ts';
import { projectStore } from '@/store/projectStore.ts';
import { timelineStore } from '@/store/timelineStore.ts';

/**
 * SRT 파일을 읽어 새 텍스트 트랙에 자막으로 추가한다 (undo 한 번에 모두 되돌아간다).
 * 사용자에게 알릴 내용(실패, 건너뛴 블록)이 있으면 그 문구와 심각도를, 없으면 null을 돌려준다.
 */
export async function importSubtitleFile(
  file: Blob,
): Promise<{ message: string; severity: 'error' | 'warning' } | null> {
  const { cues, skipped } = parseSrt(await file.text());
  if (cues.length === 0) {
    return { message: '자막을 찾지 못했습니다 (SRT 형식인지 확인해 주세요)', severity: 'error' };
  }
  const { project, dispatch } = projectStore.getState();
  const plan = planSubtitleImport(project, cues, () => crypto.randomUUID());
  if (!dispatch(createImportSubtitlesCommand(plan))) {
    return { message: '자막을 추가하지 못했습니다', severity: 'error' };
  }
  const first = plan.overlays[0];
  if (first) {
    timelineStore.getState().selectItem(first.id);
  }
  return skipped > 0
    ? {
        message: `자막 ${String(cues.length)}개를 가져왔고, 형식이 잘못된 ${String(skipped)}개는 건너뛰었습니다`,
        severity: 'warning',
      }
    : null;
}
