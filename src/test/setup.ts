import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom에는 DragEvent가 없어 fireEvent.drag*가 일반 Event로 만들어지고 clientX 등이 빠진다.
// 좌표를 다루는 드래그 테스트를 위해 MouseEvent 기반의 최소 구현을 제공한다.
if (!('DragEvent' in window)) {
  class DragEventPolyfill extends MouseEvent {
    readonly dataTransfer: DataTransfer | null;

    constructor(type: string, init: DragEventInit = {}) {
      super(type, init);
      this.dataTransfer = init.dataTransfer ?? null;
    }
  }
  Object.defineProperty(window, 'DragEvent', { value: DragEventPolyfill, configurable: true });
}

afterEach(() => {
  cleanup();
});
