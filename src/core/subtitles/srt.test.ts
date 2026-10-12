import { describe, expect, it } from 'vitest';
import { formatSrtTime, isSubtitleFileName, parseSrt, serializeSrt } from './srt.ts';

const S = 1_000_000;

describe('parseSrt', () => {
  it('표준 SRT를 μs 시각과 여러 줄 텍스트로 읽는다', () => {
    const result = parseSrt(
      [
        '1',
        '00:00:01,000 --> 00:00:02,500',
        '안녕하세요',
        '',
        '2',
        '00:01:02,040 --> 01:00:00,000',
        '첫 줄',
        '둘째 줄',
        '',
      ].join('\n'),
    );

    expect(result).toEqual({
      cues: [
        { start: S, end: 2.5 * S, text: '안녕하세요' },
        { start: 62_040_000, end: 3600 * S, text: '첫 줄\n둘째 줄' },
      ],
      skipped: 0,
    });
  });

  it('BOM, CRLF, 여러 빈 줄, 번호 없는 블록을 받아들인다', () => {
    const source =
      '\uFEFF1\r\n00:00:00,000 --> 00:00:01,000\r\n하나\r\n\r\n\r\n00:00:01,000 --> 00:00:02,000\r\n둘\r\n';

    expect(parseSrt(source).cues.map((cue) => cue.text)).toEqual(['하나', '둘']);
  });

  it('소수점 구분자, 시 생략, 짧은 밀리초, 좌표 꼬리를 받아들인다', () => {
    const result = parseSrt(
      '1\n00:01.5 --> 00:02.25 X1:100 X2:200\n텍스트\n\n2\n0:00:03.007 --> 0:00:04,000\n다음\n',
    );

    expect(result.cues.map(({ start, end }) => [start, end])).toEqual([
      [1.5 * S, 2.25 * S],
      [3_007_000, 4 * S],
    ]);
  });

  it('서식 태그와 ASS 위치 태그를 지운다', () => {
    const { cues } = parseSrt(
      '1\n00:00:00,000 --> 00:00:01,000\n{\\an8}<i>기울임</i> <font color="#ff0">노랑</font>\n',
    );

    expect(cues[0]?.text).toBe('기울임 노랑');
  });

  it('시간이 잘못되었거나 내용이 없는 블록은 건너뛰고 개수를 센다', () => {
    const result = parseSrt(
      [
        '1',
        '00:00:05,000 --> 00:00:04,000',
        '거꾸로',
        '',
        '2',
        '잘못된 시간',
        '내용',
        '',
        '3',
        '00:00:06,000 --> 00:00:07,000',
        '<i></i>',
        '',
        '4',
        '00:00:08,000 --> 00:00:09,000',
        '정상',
      ].join('\n'),
    );

    expect(result.cues).toEqual([{ start: 8 * S, end: 9 * S, text: '정상' }]);
    expect(result.skipped).toBe(3);
  });

  it('시작 시각 순으로 정렬한다', () => {
    const { cues } = parseSrt(
      '1\n00:00:05,000 --> 00:00:06,000\n뒤\n\n2\n00:00:01,000 --> 00:00:02,000\n앞\n',
    );

    expect(cues.map((cue) => cue.text)).toEqual(['앞', '뒤']);
  });

  it('빈 문자열은 빈 결과', () => {
    expect(parseSrt('')).toEqual({ cues: [], skipped: 0 });
    expect(parseSrt('\n\n  \n')).toEqual({ cues: [], skipped: 0 });
  });
});

describe('formatSrtTime', () => {
  it('HH:MM:SS,mmm 형식, 밀리초 미만은 반올림', () => {
    expect(formatSrtTime(0)).toBe('00:00:00,000');
    expect(formatSrtTime(33_333)).toBe('00:00:00,033');
    expect(formatSrtTime(3_723_456_700)).toBe('01:02:03,457');
    expect(formatSrtTime(59_999_600)).toBe('00:01:00,000');
  });

  it('음수는 거부한다', () => {
    expect(() => formatSrtTime(-1)).toThrow(RangeError);
  });
});

describe('serializeSrt', () => {
  it('번호·시각·텍스트를 CRLF로 쓰고, 내용 안의 빈 줄은 뺀다', () => {
    const text = serializeSrt([
      { start: S, end: 2 * S, text: '하나' },
      { start: 3 * S, end: 4 * S, text: '첫 줄\n\n둘째 줄' },
    ]);

    expect(text).toBe(
      '1\r\n00:00:01,000 --> 00:00:02,000\r\n하나\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\n첫 줄\r\n둘째 줄\r\n',
    );
  });

  it('직렬화한 결과를 다시 읽으면 같은 자막이 된다 (밀리초 단위)', () => {
    const cues = [
      { start: 0, end: 1_500_000, text: '하나' },
      { start: 61_234_000, end: 62_000_000, text: '여러\n줄' },
    ];

    expect(parseSrt(serializeSrt(cues))).toEqual({ cues, skipped: 0 });
  });
});

describe('isSubtitleFileName', () => {
  it('확장자 .srt만 자막으로 본다 (대소문자 무관)', () => {
    expect(isSubtitleFileName('movie.ko.srt')).toBe(true);
    expect(isSubtitleFileName('MOVIE.SRT')).toBe(true);
    expect(isSubtitleFileName('movie.vtt')).toBe(false);
    expect(isSubtitleFileName('srt.mp4')).toBe(false);
  });
});
