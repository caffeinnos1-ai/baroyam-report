// 김비서AI 확장프로그램 · 대시보드 쪽 다리
// 대시보드 페이지와 확장(background.js) 사이에서 말을 옮긴다 · 페이지는 window.postMessage 로,
// 확장은 chrome.runtime 으로 말한다. 페이지가 확장이 깔렸는지 알 수 있게 html 에 표시를 남긴다.

const FROM_PAGE = 'baroyam-dashboard';
const FROM_EXT = 'baroyam-inv-ext';
const toPage = (msg) => window.postMessage({ source: FROM_EXT, ...msg }, location.origin);

document.documentElement.dataset.baroyamInvExt = chrome.runtime.getManifest().version;
toPage({ type: 'ready' });

// 페이지 → 확장 · 어드민 수집 단추
window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data || e.data.source !== FROM_PAGE) return;
  // 재고(inventory-start) · 당일판매(sales-start, 1.2.0~)
  if (e.data.type === 'inventory-start' || e.data.type === 'sales-start') {
    // 확장을 새로고침(↻)하면 이미 열려 있던 이 탭의 옛 코드는 확장과 끊긴다 · 그때 sendMessage 는 약속(promise)이 아니라
    // 그 자리에서 오류("Extension context invalidated")를 던지므로 try 로 받아 대시보드 새로고침을 안내한다
    const stale = () => toPage({ type: 'status', message: '확장 프로그램이 새로 바뀌었습니다 · 이 화면을 새로고침(F5)한 뒤 어드민 수집을 다시 눌러 주세요', done: true });
    try {
      if (!chrome.runtime || !chrome.runtime.id) { stale(); return; }
      chrome.runtime.sendMessage({ type: 'start', kind: e.data.type === 'sales-start' ? 'sales' : 'inventory' })
        .then((r) => { if (!r || !r.ok) toPage({ type: 'status', message: (r && r.message) || '이지어드민을 열지 못했습니다', done: true }); })
        .catch(stale);
    } catch (err) {
      stale();
    }
  }
});

// 확장 → 페이지 · 진행 상황과 읽은 표 · 표는 페이지가 저장하고 결과(inventory-ack)를 돌려줄 때까지 기다린다
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'status') { toPage(msg); return; }
  if (msg.type !== 'rows' && msg.type !== 'error') return;
  const id = Math.random().toString(36).slice(2);
  const onAck = (e) => {
    if (e.source !== window || !e.data || e.data.source !== FROM_PAGE || e.data.type !== 'inventory-ack' || e.data.id !== id) return;
    window.removeEventListener('message', onAck);
    clearTimeout(timer);
    sendResponse({ ok: !!e.data.ok, message: e.data.message });
  };
  const timer = setTimeout(() => {
    window.removeEventListener('message', onAck);
    sendResponse({ ok: false, message: '대시보드가 답하지 않습니다 · 대시보드 창을 새로고침한 뒤 다시 눌러 주세요.' });
  }, 30000);
  window.addEventListener('message', onAck);
  const kind = msg.kind === 'sales' ? 'sales' : 'inventory';
  toPage({ type: msg.type === 'rows' ? kind : kind + '-error', id, rows: msg.rows, shipped: msg.shipped, orders: msg.orders, message: msg.message });
  return true;
});
