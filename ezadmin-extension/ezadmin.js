// 김비서AI 확장프로그램 · 이지어드민 창
// 대시보드의 "어드민 수집"이 연 창에서만 움직인다(background 에 whoami 로 묻는다) · 사람은 로그인만 하고,
// 로그인되면 현 재고조회(I100)로 가서 검색 → 표를 읽어 넘긴다. 상품 한 줄 만들기(브랜드·유통기한)는 대시보드가 한다.
// 당일판매(kind 'sales', 1.2.0~) · 로그인 뒤 첫 화면이면 "배송(금일)" 숫자를 먼저 챙기고, 정산통계 > 당일판매분요약표로 넘어가
// 검색 → 표(상품명·당일수량·정상재고)와 주문수량을 읽어 넘긴다 · 읽는 칸은 VPS(caffeinnos-automation/daily_report.js)와 같다.

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

// ---------- 당일판매 ----------
const norm = (t) => String(t || '').replace(/\s+/g, '');
const numOf = (t) => { const m = norm(t).match(/-?[\d,]+/); return m ? m[0].replace(/,/g, '') : null; };

// 당일판매분요약표 화면인가 · 표 머리 칸 id 가 <표id>_normal_stock 이다
const isSalesPage = () => !!document.querySelector('table.ui-jqgrid-btable') && !!document.querySelector('[id$="_normal_stock"],[aria-describedby$="_normal_stock"]');

// 메인 화면 "처리현황 · 배송(금일)" · daily_report.js readShippedToday 와 같은 순서로 찾는다
function readShipped() {
  const labels = [...document.querySelectorAll('td,th,div,span,p,a,li,dt,strong')].filter((el) => {
    const t = norm(el.textContent);
    return (t === '배송(금일)' || t === '배송금일') && !el.querySelector('td,th,div,span,p,a,li,dt,strong');
  });
  for (const label of labels) {
    const cell = label.closest('td,th'), tr = cell && cell.closest('tr');
    if (tr) {
      const idx = [...tr.children].indexOf(cell);
      for (let row = tr.nextElementSibling; row; row = row.nextElementSibling) {
        const v = row.children[idx] && numOf(row.children[idx].textContent);
        if (v !== null) return v;
      }
    }
    for (let sib = label.nextElementSibling; sib; sib = sib.nextElementSibling) {
      const v = numOf(sib.textContent);
      if (v !== null) return v;
    }
    let el = label.parentElement;
    for (let d = 0; d < 4 && el; d++, el = el.parentElement) {
      const v = numOf(norm(el.textContent).replace(/배송\(?금일\)?/, ''));
      if (v !== null) return v;
    }
  }
  return null;
}

// 메뉴의 "당일판매분요약표"로 · 주소가 보이는 링크면 그 주소로 가고, javascript: 링크면 정산통계를 연 뒤 누른다
async function goSalesPage() {
  const find = (txt) => [...document.querySelectorAll('a,li,span,div')].find((el) => norm(el.innerText || el.textContent) === txt && !el.querySelector('a,li'));
  const menu = await waitFor(() => find('당일판매분요약표'), 10000);
  if (!menu) throw new Error('메뉴에서 "당일판매분요약표"를 찾지 못했습니다 · 이지어드민 메뉴 이름이 바뀌었는지 확인해 주세요.');
  const a = menu.closest('a') || menu;
  const href = a.getAttribute && a.getAttribute('href');
  if (href && !/^javascript:/i.test(href) && href !== '#') { location.href = new URL(href, location.href).href; return; }
  const top = find('정산통계');
  if (top) { (top.closest('a') || top).click(); await sleep(1200); }
  a.click();
}

async function collectSales() {
  banner('당일판매를 검색하는 중…');
  status('당일판매분요약표에서 검색하는 중');
  await sleep(800);
  const btn = [...document.querySelectorAll('a,button,input[type=button],span,div')]
    .find((el) => /^검색\s*\(F2\)$/.test((el.innerText || el.value || '').trim()) && el.offsetParent !== null);
  if (btn) btn.click();
  else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', code: 'F2', keyCode: 113, which: 113, bubbles: true }));
  // 판매가 0건인 날에는 행이 끝내 생기지 않는다 · 20초 기다려 없으면 빈 표로 넘긴다(daily_report.js 와 같음)
  await waitFor(() => document.querySelector('table.ui-jqgrid-btable tbody > tr[id]'), 20000);
  await sleep(1800);
  const grid = document.querySelector('table.ui-jqgrid-btable');
  const gid = grid.id;
  const rows = [...grid.querySelectorAll('tbody > tr[id]')].map((tr) => {
    const c = (f) => { const td = tr.querySelector(`td[aria-describedby="${gid}_${f}"]`); return td ? td.innerText.trim() : null; };
    const raw = c('name'), qty = c('qty'), stock = c('normal_stock');
    return raw == null || qty == null || stock == null ? null : { raw, qty, stock };
  }).filter(Boolean);
  const head = [...document.querySelectorAll('td.header2')].find((e) => e.innerText.trim() === '주문수량');
  const orders = head && head.nextElementSibling ? head.nextElementSibling.innerText.trim() : null;
  return { rows, orders };
}

async function runSales(who) {
  if (isSalesPage() || (await waitFor(isSalesPage, 3000))) {
    const { rows, orders } = await collectSales();
    banner(`${rows.length}개 상품을 읽었습니다 · 대시보드에 저장하는 중…`);
    const res = await send({ type: 'rows', rows, orders });
    if (res && res.ok) banner(res.message || '저장했습니다');
    else banner((res && res.message) || '대시보드에 저장하지 못했습니다', 'error');
    return;
  }
  if (who.moves >= 3) throw new Error('당일판매분요약표 화면으로 넘어가지 못했습니다(3번 시도).');
  // 첫 화면에만 있는 배송(금일) 숫자를 먼저 챙긴다(처리현황은 늦게 채워지므로 잠깐 기다린다)
  if (who.shipped == null) {
    const v = await waitFor(readShipped, 6000);
    if (v !== null) await send({ type: 'meta', shipped: v });
  }
  banner('로그인 확인 · 당일판매분요약표로 이동합니다');
  status('로그인 확인 · 당일판매분요약표를 여는 중');
  await send({ type: 'meta', moved: true });
  await goSalesPage();
  // javascript: 메뉴가 같은 쪽 안에서 화면만 바꾸는 경우 · 새로 읽히지 않으므로 여기서 이어 간다
  if (await waitFor(isSalesPage, 15000)) await runSales({ ...who, moves: 99 });
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
  // 당일판매 · 메뉴로 요약표에 가서 읽는다
  if (who.kind === 'sales') {
    try { await runSales(who); }
    catch (err) { banner(err.message, 'error'); send({ type: 'error', message: err.message }); }
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
