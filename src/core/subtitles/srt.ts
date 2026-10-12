import type { Microseconds } from '../time.ts';

/** 자막 한 줄(큐). 시간은 μs, text는 여러 줄(\n)일 수 있다 */
export interface SubtitleCue {
  start: Microseconds;
  end: Microseconds;
  text: string;
}

export interface SrtParseResult {
  cues: SubtitleCue[];
  /** 시간 줄이 잘못되었거나 내용이 비어 건너뛴 블록 수 */
  skipped: number;
}

const US_PER_MS = 1000;

/**
 * `HH:MM:SS,mmm` 시각. 실제 파일에서 흔한 변형(소수점 `.`, 시 생략, 1~3자리 밀리초)도 받는다.
 * 밀리초가 1~2자리면 소수 자릿수로 해석한다 (`,5` = 500ms).
 */
const TIME = String.raw`(?:(\d+):)?(\d{1,2}):(\d{1,2})[,.](\d{1,3})`;
const TIMING_LINE = new RegExp(String.raw`^\s*${TIME}\s*-->\s*${TIME}`);

/** 서식 태그(<i>, <font color=..>)와 ASS 위치 태그({\an8})는 지원하지 않으므로 지운다 */
const MARKUP = /<\/?[a-z][^>]*>|\{\\[^}]*\}/gi;

function toUs(hours = '0', minutes: string, seconds: string, fraction: string): Microseconds {
  const ms = Number(fraction.padEnd(3, '0'));
  const totalSeconds = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  return (totalSeconds * 1000 + ms) * US_PER_MS;
}

function parseTiming(line: string): { start: Microseconds; end: Microseconds } | null {
  const match = TIMING_LINE.exec(line);
  if (!match) {
    return null;
  }
  const [, h1, m1 = '', s1 = '', f1 = '', h2, m2 = '', s2 = '', f2 = ''] = match;
  return { start: toUs(h1, m1, s1, f1), end: toUs(h2, m2, s2, f2) };
}

/**
 * SRT 텍스트를 자막 목록으로 바꾼다. 잘못된 블록은 전체를 실패시키지 않고 건너뛴다.
 * 번호 줄은 없어도 되고, 빈 줄로 구분된 블록 안에서 `-->`가 있는 줄을 시간 줄로 본다.
 */
export function parseSrt(source: string): SrtParseResult {
  const blocks = source
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/);

  const cues: SubtitleCue[] = [];
  let skipped = 0;
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.every((line) => line.trim() === '')) {
      continue;
    }
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    const timing = timingIndex === -1 ? null : parseTiming(lines[timingIndex] ?? '');
    const text = lines
      .slice(timingIndex + 1)
      .map((line) => line.replace(MARKUP, '').trim())
      .filter((line) => line !== '')
      .join('\n');
    if (!timing || timing.end <= timing.start || text === '') {
      skipped++;
      continue;
    }
    cues.push({ ...timing, text });
  }
  cues.sort((a, b) => a.start - b.start || a.end - b.end);
  return { cues, skipped };
}

/** μs를 SRT 시각 `HH:MM:SS,mmm`으로. 밀리초 미만은 반올림한다 */
export function formatSrtTime(us: Microseconds): string {
  if (!Number.isFinite(us) || us < 0) {
    throw new RangeError(`Invalid time: ${String(us)}`);
  }
  const totalMs = Math.round(us / US_PER_MS);
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const parts = [
    Math.floor(totalSeconds / 3600),
    Math.floor(totalSeconds / 60) % 60,
    totalSeconds % 60,
  ];
  return `${parts.map((n) => String(n).padStart(2, '0')).join(':')},${String(ms).padStart(3, '0')}`;
}

/** 자막 목록을 SRT 텍스트로. 번호는 1부터, 줄바꿈은 표준대로 CRLF를 쓴다 */
export function serializeSrt(cues: readonly SubtitleCue[]): string {
  return cues
    .map((cue, index) =>
      [
        String(index + 1),
        `${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}`,
        // 빈 줄은 블록 구분자이므로 내용 안의 빈 줄은 뺀다
        ...cue.text.split('\n').filter((line) => line.trim() !== ''),
        '',
      ].join('\r\n'),
    )
    .join('\r\n');
}

/** 자막 파일로 다룰 파일인지. 브라우저마다 .srt의 MIME 타입이 달라(비어 있기도 하다) 확장자로 판단한다 */
export function isSubtitleFileName(name: string): boolean {
  return /\.srt$/i.test(name);
}
