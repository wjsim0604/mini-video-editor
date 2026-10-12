import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { startPersistence } from './features/persistence/session.ts';
import { saveStatusStore } from './store/saveStatusStore.ts';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

const root = createRoot(rootElement);
root.render(
  <div className="flex h-screen items-center justify-center bg-neutral-950 text-sm text-neutral-400">
    프로젝트를 불러오는 중…
  </div>,
);

// 복원이 끝난 뒤에 편집기를 보여준다 (복원 전 편집이 저장본을 덮어쓰지 않도록)
void startPersistence().then((result) => {
  if (result.status === 'invalid') {
    saveStatusStore.setState({
      state: 'error',
      message: '저장된 프로젝트를 읽을 수 없어 새 프로젝트로 시작했습니다',
    });
  }
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
