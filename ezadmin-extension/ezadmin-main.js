// 김비서AI 확장프로그램 · 이지어드민 페이지 쪽(MAIN world) · 페이지보다 먼저(document_start) 들어간다
// 어드민 수집은 이지어드민을 눈에 안 보이는 탭(접힌 탭 묶음)에서 돌린다 · 크롬은 안 보이는 페이지에서 화면 그리기
// (requestAnimationFrame)를 멈추므로, 검색 결과 표가 그 탭을 한 번 열어 보기 전까지 그려지지 않아 수집이 멈춰 있었다(2026-10-08) ·
// 그래서 ① 페이지에는 늘 "보이는 중"이라고 알리고 ② 안 보일 때의 화면 그리기는 타이머로 대신 돌린다 ·
// 보이는 탭에서는 원래 그대로 동작한다(사람이 평소 여는 이지어드민 창도 차이가 없다).
(() => {
  const hiddenGet = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
  const reallyHidden = () => (hiddenGet && hiddenGet.get ? hiddenGet.get.call(document) : false);

  const raf = window.requestAnimationFrame && window.requestAnimationFrame.bind(window);
  const caf = window.cancelAnimationFrame && window.cancelAnimationFrame.bind(window);
  if (raf && caf) {
    // 타이머로 대신 돈 것은 음수 번호로 돌려줘 취소할 때 구분한다
    window.requestAnimationFrame = (cb) => (reallyHidden() ? -setTimeout(() => cb(performance.now()), 16) : raf(cb));
    window.cancelAnimationFrame = (id) => (id < 0 ? clearTimeout(-id) : caf(id));
  }

  try {
    Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => false });
    Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => 'visible' });
    // "보였다/숨었다" 알림도 페이지에 넘기지 않는다(넘기면 페이지가 숨은 것으로 알고 일을 멈출 수 있다)
    document.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);
  } catch (e) {}
})();
