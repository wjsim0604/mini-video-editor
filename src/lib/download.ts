/** 다운로드가 시작될 때까지 object URL을 유지할 시간 */
const REVOKE_DELAY_MS = 10_000;

/**
 * 결과 파일을 내려받는다. 링크를 문서에 잠시 붙여 클릭해야 브라우저가 download 속성(파일 이름)을 적용하고,
 * URL을 바로 해제하면 다운로드가 시작되기 전에 무효가 될 수 있어 조금 뒤에 해제한다.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, REVOKE_DELAY_MS);
}
