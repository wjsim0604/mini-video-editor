# webm 영상의 길이가 Infinity로 나오는 문제

## 문제 상황

에셋 업로드 시 `<video>`의 `loadedmetadata` 이벤트에서 `video.duration`으로 길이를 읽었다.
일반 webm은 정상이지만, 라이브 방식으로 기록된 webm(브라우저 `MediaRecorder`로 녹화한 파일 등)은
`duration`이 `Infinity`로 보고되었다. 이 값을 그대로 마이크로초로 바꾸면 타임라인 계산 전체가 깨진다.

재현용 파일은 ffmpeg로 만들었다.

```sh
ffmpeg -f lavfi -i smptebars=size=640x360:rate=30:duration=65 -c:v libvpx-vp9 -f webm -live 1 live.webm
```

| 파일           | `loadedmetadata` 시점의 `duration` |
| -------------- | ---------------------------------- |
| 일반 webm      | `3`                                |
| `-live 1` webm | `Infinity`                         |

## 원인

라이브 webm은 녹화가 끝나기 전에 헤더를 먼저 쓰기 때문에 컨테이너에 전체 길이(Segment Duration)가 없다.
브라우저는 파일 끝까지 읽기 전에는 길이를 알 수 없어서 `Infinity`를 돌려준다.

## 해결

길이가 유한하지 않으면 `currentTime`을 아주 큰 값으로 설정한다. 브라우저가 파일 끝을 찾으면서 실제 길이를 계산하고
`durationchange` 이벤트를 발생시킨다. 그 뒤에 다시 썸네일 위치로 seek한다.

```ts
if (!Number.isFinite(video.duration)) {
  const resolved = waitForMediaEvent(video, 'durationchange');
  video.currentTime = Number.MAX_SAFE_INTEGER;
  await resolved;
}
```

이벤트 대기에는 시간 제한(15초)과 `error` 이벤트 처리를 함께 넣어, 디코딩할 수 없는 파일 때문에 가져오기가 멈추지 않게 했다.
결과적으로 65초 라이브 webm이 `1:05`로 표시되었다.

## 배운 점

- 미디어 메타데이터는 "항상 있다"고 가정하면 안 된다. 외부 입력은 경계(`probeFile`)에서 검증하고 내부에는 유효한 정수 마이크로초만 들인다.
- 이 우회책은 `<video>` 기반이라서 생긴 문제다. 나중에 디먹서(WebCodecs 경로)로 바꾸면 패킷 타임스탬프로 길이를 직접 계산할 수 있다.
  `probeFile` 인터페이스 뒤에 구현을 숨겨둔 덕분에 교체 범위가 이 파일 하나로 제한된다.

> **후속 (같은 날)**: 재생 항목에서 에셋 분석을 mediabunny로 교체하면서 이 우회 코드는 제거되었다.
> 디먹서가 패킷 타임스탬프로 길이를 직접 계산(`track.computeDuration()`)하므로 같은 파일이 처음부터 `1:05`로 나온다.
