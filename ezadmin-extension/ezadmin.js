// 바로얌 재고 수집 · 이지어드민 창
// 대시보드의 "어드민 수집"이 연 창에서만 움직인다(background 에 whoami 로 묻는다) · 사람은 로그인만 하고,
// 로그인되면 현 재고조회(I100)로 가서 검색 → 표를 읽어 넘긴다. 상품 한 줄 만들기(브랜드·유통기한)는 대시보드가 한다.

const I100_PATH = '/template35.htm';
const I100_URL = 'https://ga83.ezadmin.co.kr/template35.htm?template=I100';
const LOGIN_URL = 'https://login3.ezadmin.co.kr/login.htm';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => null);
const status = (message) => send({ type: 'status', message });

// 창 위쪽에 띄우는 작은 안내 띠 · 지금 무엇을 하는지 사람이 알 수 있게
function banner(text, tone) {
  let el = document.getElementById('baroyam-inv-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'baroyam-inv-banner';
    el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:10px 18px;border-radius:999px;'
      + 'font:700 14px/1.4 "Malgun Gothic",sans-serif;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.25);pointer-events:none';
    (document.body || document.documentElement).appendChild(el);
  }
  el.style.background = tone === 'error' ? '#dc2626' : '#e2672a';
  el.textContent = '바로얌 · ' + text;
}

async function waitFor(fn, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await sleep(500);
  }
  return null;
}

const rowCount = () => document.querySelectorAll('#grid1 tbody > tr[id]').length;
function pagingTotal() {
  const info = document.querySelector('.ui-paging-info');
  const m = info && info.innerText.match(/\/\s*([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

async function collect() {
  if (!(await waitFor(() => document.getElementById('grid1'), 15000))) throw new Error('현 재고조회 표를 찾지 못했습니다.');
  banner('재고를 검색하는 중…');
  status('현 재고조회에서 검색하는 중');
  await sleep(800);
  // 검색(F2) 단추를 누른다 · 단추를 못 찾으면 F2 키를 보낸다
  const btn = [...document.querySelectorAll('a,button,input[type=button],span,div')]
    .find((el) => /^검색\s*\(F2\)$/.test((el.innerText || el.value || '').trim()) && el.offsetParent !== null);
  if (btn) btn.click();
  else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', code: 'F2', keyCode: 113, which: 113, bubbles: true }));
  if (!(await waitFor(rowCount, 30000))) throw new Error('검색 결과가 나오지 않았습니다(30초).');
  await sleep(1500);

  // 한 쪽에 다 안 들어오면 500개씩 보기로 바꾼다
  const total = pagingTotal();
  if (total && total > rowCount()) {
    const sel = document.querySelector('#gridpager select.ui-pg-selbox');
    if (sel) { sel.value = '500'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    await waitFor(() => rowCount() >= Math.min(total, 500), 30000);
    await sleep(1000);
  }
  const rows = [...document.querySelectorAll('#grid1 tbody > tr[id]')].map((tr) => {
    const c = (f) => { const td = tr.querySelector(`td[aria-describedby="grid1_${f}"]`); return td ? td.innerText.trim() : ''; };
    return { code: c('product_id'), supply: c('supply_name'), name: c('product_name'), stock: c('stock'), period: c('period_trans') };
  });
  if ((pagingTotal() || 0) > rows.length) throw new Error(`목록을 다 읽지 못했습니다: ${rows.length} / ${pagingTotal()}`);
  return rows;
}

(async () => {
  const who = await send({ type: 'whoami' });
  if (!who || !who.isJob) return;

  // 로그인 화면 · 이때만 창을 앞으로 띄우고, 사람이 로그인할 때까지 아무것도 하지 않는다
  if (/login/i.test(location.pathname)) {
    banner('로그인하면 창이 내려가고 재고를 자동으로 가져옵니다');
    status('이지어드민 창에서 로그인해 주세요 · 로그인하면 창이 내려가고 자동으로 가져옵니다');
    send({ type: 'show' });
    return;
  }
  // 로그인된 화면 · 창을 다시 내리고 뒤에서 이어 간다
  send({ type: 'hide' });
  // 로그인이 풀린 I100 은 "mysqli ..." 한 줄만 보인다 → 로그인 화면으로
  if (/mysqli/.test(document.body ? document.body.innerText : '')) {
    location.href = LOGIN_URL;
    return;
  }
  // 로그인 뒤 첫 화면 등 · 현 재고조회로
  if (location.pathname !== I100_PATH || !/template=I100/.test(location.search)) {
    banner('로그인 확인 · 현 재고조회로 이동합니다');
    status('로그인 확인 · 현 재고조회를 여는 중');
    location.href = I100_URL;
    return;
  }
  try {
    const rows = await collect();
    banner(`${rows.length}개를 읽었습니다 · 대시보드에 저장하는 중…`);
    const res = await send({ type: 'rows', rows });
    if (res && res.ok) banner(res.message || '저장했습니다');
    else banner((res && res.message) || '대시보드에 저장하지 못했습니다', 'error');
  } catch (err) {
    banner(err.message, 'error');
    send({ type: 'error', message: err.message });
  }
})();
