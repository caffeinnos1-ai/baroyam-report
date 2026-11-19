// 김비서AI 확장프로그램 · 쿠팡 광고센터 창 (1.6.0~ · 2026-11-19)
// 대시보드 판매채널 › 쿠팡 › 쿠팡광고성과의 "쿠팡윙 수집"이 연 창에서만 움직인다(background 에 whoami 로 묻는다).
// 사람은 로그인만 하고, 보고서 화면에서 아래 조건을 글자로 찾아 고른 뒤 "보고서 만들기" → 다 만들어지면 "다운로드"를 누른다.
//   기간 = 이번 달 1일 ~ 오늘 · 기간 구분 = 일별 · 캠페인 = 모든 캠페인 · 보고서 구조 = 캠페인·광고그룹·상품·키워드 ·
//   클릭이 발생한 키워드만 포함
// 내려받은 파일은 background 가 받아 대시보드로 넘기고, 대시보드가 저장한다.
// 쿠팡 화면 모양을 아직 실제로 맞춰 보지 못해, 어느 단계든 못 찾으면 창을 앞으로 띄우고 "직접 만들어 다운로드만 눌러 달라"고 알린다 ·
// 사람이 다운로드를 눌러도 같은 길로 ERP 에 들어간다.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (msg) => {
  try {
    if (!chrome.runtime || !chrome.runtime.id) return Promise.resolve(null);
    return chrome.runtime.sendMessage(msg).catch(() => null);
  } catch (e) { return Promise.resolve(null); }
};
const status = (message) => send({ type: 'status', message });
const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim();

function banner(text, tone) {
  let el = document.getElementById('baroyam-cp-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'baroyam-cp-banner';
    el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:10px 18px;border-radius:999px;max-width:80vw;'
      + 'font:600 14px/1.45 "Malgun Gothic",sans-serif;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.25);pointer-events:none;text-align:center';
    (document.body || document.documentElement).appendChild(el);
  }
  el.style.background = tone === 'error' ? '#dc2626' : tone === 'hand' ? '#2563eb' : '#e2672a';
  el.textContent = '바로얌 · ' + text;
}
const visible = (e) => !!(e && e.offsetParent !== null && e.getClientRects().length);
// 글자로 찾기 · 가장 안쪽(자식에 같은 글자가 없는) 보이는 것
function findText(re, sel) {
  const list = [...document.querySelectorAll(sel || 'button,a,label,li,span,div,p,input[type=button],input[type=submit]')]
    .filter((e) => visible(e) && re.test(norm(e.innerText || e.value || e.textContent)));
  return list.find((e) => ![...e.children].some((c) => re.test(norm(c.innerText || c.textContent)))) || list[0] || null;
}
async function waitFor(fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(500); }
  return null;
}
const press = (el) => { const t = el.closest('button,a,label,[role=button],[role=tab],[role=radio],[role=option],li') || el; t.click(); return t; };
// 체크칸 켜기 · 이미 켜져 있으면 그대로
function check(re) {
  const el = findText(re, 'label,span,div,p,li'); if (!el) return false;
  const box = (el.closest('label') || el.parentElement || el).querySelector('input[type=checkbox]');
  if (box) { if (!box.checked) box.click(); return true; }
  const aria = el.closest('[role=checkbox]');
  if (aria) { if (aria.getAttribute('aria-checked') !== 'true') aria.click(); return true; }
  press(el); return true;
}
// 날짜 칸 넣기 · React 같은 화면도 값을 받도록 원래 setter 로 넣고 input/change 를 보낸다
function setInput(inp, v) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(inp, v); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
  inp.dispatchEvent(new Event('blur', { bubbles: true }));
}
// 기간 · "기간 설정"을 눌러 달력을 열고 이번 달 1일 → 오늘을 차례로 누른 뒤 적용(사용자 설명 · 11-19) ·
// 달력에 "이번 달" 같은 빠른 선택이 있으면 그것, 날짜 칸이 있으면 직접 넣기도 해 본다 · 넣은 뒤 화면에 두 날짜가 보이는지 확인
const dateForms = (d) => { const [y, m, dd] = d.split('-'); return [d, y + '.' + m + '.' + dd, y + '/' + m + '/' + dd, y + '. ' + (+m) + '. ' + (+dd)]; };
// 날짜 칸 값에 두 날짜가 다 들어 있으면 된 것 · 오른쪽 보고서 목록에 같은 기간 줄이 있을 수 있어 화면 글자는 보지 않는다
const periodShown = (from, to) => {
  const t = [...document.querySelectorAll('input')].filter(visible).map((x) => x.value).join(' ');
  return dateForms(from).some((f) => t.includes(f)) && dateForms(to).some((f) => t.includes(f));
};
const dayCells = (box) => [...box.querySelectorAll('td,button,span,div,a')].filter((e) => visible(e) && /^\d{1,2}$/.test(norm(e.innerText)) && ![...e.children].some((c) => /^\d{1,2}$/.test(norm(c.innerText))));
const offDay = (e) => { const c = String(e.className || '') + ' ' + String((e.parentElement && e.parentElement.className) || ''); return /disabled|outside|other|prev|next|muted|neighbor/i.test(c) || e.getAttribute('aria-disabled') === 'true' || e.disabled; };
// 달력 칸 누르기 · 누름 처리를 mousedown 에 둔 달력도 있어 셋 다 보낸다
const tap = (e) => { const t = e.closest('button,td,[role=gridcell],a') || e; ['mousedown', 'mouseup'].forEach((k) => t.dispatchEvent(new MouseEvent(k, { bubbles: true }))); t.click(); };
// 보고서 기간 · 실제 화면(11-19 사용자 캡처): 라디오 "기간 설정" → "시작일 ~ 종료일" 칸 → 두 달 달력(2026년 11월 | 12월 · 오늘 뒤는 흐림)
// → 이번 달 1일 → 오늘을 누르면 칸에 2026-11-01 ~ 2026-11-19 가 들어간다
async function setPeriod(from, to) {
  pickRadio(/^기간 ?설정/);
  await sleep(600);
  if (periodShown(from, to)) return true;
  const startIn = [...document.querySelectorAll('input')].find((x) => visible(x) && /시작일/.test(x.placeholder || '')) ||
    [...document.querySelectorAll('input')].find((x) => visible(x) && /^\d{4}-\d{2}-\d{2}$/.test(x.value || ''));
  if (startIn) { startIn.focus(); tap(startIn); await sleep(1000); }
  const [y, m] = from.split('-').map(Number), today = +to.slice(8);
  const head = await waitFor(() => findText(new RegExp(String.raw`^${y}\s*[.\-/년]\s*0?${m}\s*월?$`)), 4000);
  if (!head) return false;
  // 머리에서 위로 올라가며 날짜 칸이 한 달치(28개 이상) 들어 있는 상자를 찾는다
  let box = head;
  while (box && box !== document.body && dayCells(box).length < 28) box = box.parentElement;
  if (!box || box === document.body) return false;
  const cells = dayCells(box);
  // 앞 달 끝(29·30)이 먼저 나오므로 "1"(흐리지 않은 것) 다음부터 오늘을 찾는다
  const i1 = cells.findIndex((e) => norm(e.innerText) === '1' && !offDay(e));
  const i1b = i1 >= 0 ? i1 : cells.findIndex((e) => norm(e.innerText) === '1');
  const it = cells.findIndex((e, k) => k >= i1b && +norm(e.innerText) === today);
  if (i1b < 0 || it < 0) return false;
  tap(cells[i1b]); await sleep(500);
  tap(cells[it]); await sleep(800);
  const ok = findText(/^(적용|확인|선택|완료)$/, 'button,[role=button],a');
  if (ok && !periodShown(from, to)) { ok.click(); await sleep(800); }
  // 달력이 아직 열려 있으면 닫는다
  const title = findText(/^보고서 ?구조$/); if (title) title.click();
  await sleep(300);
  return periodShown(from, to);
}

let handMode = false;
// 사람이 직접 고칠 때 · 그 사람이 "보고서 만들기"를 누르면 그때부터는 다시 자동으로 완료를 기다려 내려받는다
async function hand(why, job) {
  if (handMode) return; handMode = true;
  banner(job ? (why + ' · 직접 고친 뒤 "보고서 만들기"만 눌러 주세요 · 그다음은 자동') : '이 창에서 보고서를 직접 만들고 "다운로드"만 눌러 주세요 · 내려받은 파일은 자동으로 ERP 에 들어갑니다', 'hand');
  await status((why ? why + ' · ' : '') + (job ? '쿠팡 창에서 직접 고친 뒤 "보고서 만들기"만 눌러 주세요(그다음은 자동)' : '쿠팡 창에서 보고서를 직접 만들고 다운로드만 눌러 주세요(파일은 자동으로 ERP 에 들어갑니다)'));
  await send({ type: 'show' });
  if (!job) return;
  document.addEventListener('click', async function onMake(e) {
    const b = e.target.closest && e.target.closest('button,[role=button],input[type=submit]');
    if (!b || !/^보고서 ?만들기$/.test(norm(b.innerText || b.value)) || !enabled(b)) return;
    document.removeEventListener('click', onMake, true);
    const before = ourRows(job).length;
    await send({ type: 'meta', phase: 'download', before });
    job.phase = 'download'; job.before = before;
    await sleep(1000);
    watchDownload(job);
  }, true);
}

const REPORT_PATH = '/marketing-reporting/billboard/reports/pa';
const REPORT_URL = 'https://advertising.coupang.com' + REPORT_PATH;
const makeBtn = () => [...document.querySelectorAll('button,[role=button],input[type=submit]')].find((e) => visible(e) && /^보고서 ?만들기$/.test(norm(e.innerText || e.value)));
const enabled = (e) => e && !e.disabled && e.getAttribute('aria-disabled') !== 'true' && !/disabled/i.test(e.className || '');

// 캠페인 선택 · "캠페인을 선택하세요" 목록을 열고 전체 선택(없으면 보이는 캠페인을 모두) 고른다
async function pickAllCampaigns() {
  // 1) 진짜 <select> 이면 모두 고르기
  const sel = [...document.querySelectorAll('select')].find((x) => visible(x) && /캠페인/.test(norm((x.closest('div') || x).parentElement ? x.parentElement.innerText : '')));
  if (sel && sel.multiple) { [...sel.options].forEach((o) => { o.selected = true; }); sel.dispatchEvent(new Event('change', { bubbles: true })); return true; }
  // 2) 꾸민 목록 · 자리 글("캠페인을 선택하세요")이나 지금 고른 값 칸을 눌러 연다
  const holder = findText(/캠페인을 ?선택/, 'div,span,input,button,p') || (() => {
    const lab = findText(/^캠페인 ?선택$/, 'label,div,span,p,h3,h4,strong');
    return lab && lab.parentElement && [...lab.parentElement.querySelectorAll('div,input,button')].find((x) => visible(x) && x !== lab && !x.contains(lab));
  })();
  if (!holder) return false;
  const boxesBefore = new Set(document.querySelectorAll('input[type=checkbox]'));
  (holder.closest('[class*=select],[class*=Select],[class*=dropdown],[class*=Dropdown],[role=combobox],button') || holder).click();
  holder.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await sleep(1200);
  const all = findText(/^(전체 ?선택|모든 ?캠페인|전체 ?캠페인|전체|Select ?all)$/);
  if (all) {
    const box = (all.closest('label,li,[role=option],div') || all).querySelector('input[type=checkbox]');
    if (!box || !box.checked) press(all);
  } else {
    // 전체 선택이 없으면 목록에 새로 나타난 체크칸(또는 항목)을 모두 누른다
    const boxes = [...document.querySelectorAll('input[type=checkbox]')].filter((b) => !boxesBefore.has(b) && !b.checked);
    if (boxes.length) boxes.forEach((b) => (b.closest('label') || b).click());
    else {
      const opts = [...document.querySelectorAll('[role=option],li[class*=option],div[class*=option]')].filter(visible);
      if (!opts.length) return false;
      for (const o of opts) { if (o.getAttribute('aria-selected') !== 'true') { o.click(); await sleep(120); } }
    }
  }
  await sleep(500);
  // 전체선택이 정말 켜졌는지 · 안 켜졌으면 체크칸을 직접 누른다
  if (all) {
    const box = (all.closest('label,li,[role=option],div') || all).querySelector('input[type=checkbox]');
    if (box && !box.checked) { box.click(); await sleep(400); }
  }
  // 목록 아래 "확인"을 눌러야 고른 것이 들어간다(11-19 사용자 · Esc·바깥 누르기는 취소가 될 수 있음)
  const okBtn = await waitFor(() => [...document.querySelectorAll('button,[role=button]')].filter((b) => visible(b) && /^확인$/.test(norm(b.innerText))).pop(), 3000);
  if (!okBtn) return false;
  okBtn.click();
  await sleep(1000);
  // 칸 글자가 다시 그려질 수 있어 화면에서 다시 찾는다 · 자리 글이 사라졌으면 들어간 것
  return !findText(/^캠페인을 ?선택하세요$/, 'div,span,p,button');
}
function pickRadio(re) {
  const el = findText(re, 'label,span,div,p'); if (!el) return false;
  const r = (el.closest('label') || el.parentElement || el).querySelector('input[type=radio]');
  if (r) { if (!r.checked) (r.closest('label') || r).click(); return true; }
  press(el); return true;
}

async function run(job) {
  const host = location.hostname;
  // 로그인 화면 · 창을 앞으로 띄우고 기다린다(로그인되면 광고센터로 돌아와 이 코드가 다시 돈다)
  if (/xauth|login|wing\./.test(host) || /login|signin/i.test(location.pathname) || document.querySelector('input[type=password]')) {
    banner('쿠팡에 로그인해 주세요 · 로그인되면 자동으로 보고서를 만듭니다');
    await status('쿠팡 로그인을 기다리는 중 · 앞에 뜬 창에서 로그인해 주세요');
    await send({ type: 'show' });
    return;
  }
  await send({ type: 'hide' });
  // 보고서 화면이 아니면 보고서 주소로(세 번까지 · 로그인 뒤 광고 홈으로 떨어지는 경우)
  if (location.pathname.indexOf(REPORT_PATH) !== 0) {
    if ((job.moves || 0) >= 3) return hand('보고서 화면으로 가지 못했습니다');
    await send({ type: 'meta', moved: true });
    location.href = REPORT_URL;
    return;
  }
  if (job.phase === 'download') return watchDownload(job);
  banner('쿠팡 광고 보고서를 만드는 중…');
  await status('보고서 조건을 고르는 중(이번 달 · 일별 · 모든 캠페인 · 캠페인>광고그룹>상품>키워드)');
  if (!(await waitFor(makeBtn, 20000))) return hand('보고서 만들기 단추를 찾지 못했습니다', job);
  await sleep(800);
  const miss = [];
  if (!(await setPeriod(job.from, job.to))) miss.push('기간');
  await sleep(500);
  if (!pickRadio(/^일별$/)) miss.push('일별');
  await sleep(300);
  if (!pickRadio(/^캠페인 ?> ?광고 ?그룹 ?> ?상품 ?> ?키워드$/)) miss.push('보고서 구조');
  await sleep(500);
  if (!check(/클릭이 ?발생한 ?키워드/)) miss.push('클릭 발생 키워드만');
  await sleep(300);
  if (!(await pickAllCampaigns())) miss.push('모든 캠페인');
  await sleep(800);
  const go = makeBtn();
  if (miss.length || !enabled(go)) return hand('못 고른 조건: ' + (miss.join('·') || '보고서 만들기가 눌리지 않음'), job);
  // 지금 목록에 같은 조건 줄이 몇 개인지 기억 · 하나 늘어나면 그게 방금 만든 보고서(목록은 최신이 맨 위)
  const before = ourRows(job).length;
  // 누르기 전에 "받기 단계"를 먼저 적어 둔다 · 누르는 순간 화면이 새로 열려도 보고서를 또 만들지 않게
  await send({ type: 'meta', phase: 'download', before });
  job.phase = 'download'; job.before = before;
  go.click();
  await sleep(1500);
  return watchDownload(job);
}
// 오른쪽 보고서 목록(11-19 사용자 캡처) · 줄 = 요청일 | 보고서 기간 "2026-11-01 ~ 2026-11-19" | [일별] 캠페인 > … > 키워드 | 선택한 캠페인 | 상태(생성 완료) | 차트 보기 · 다운로드
// 1.6.5 까지는 기간 사이를 "-" 로만 알아봐 "~" 로 적힌 줄을 하나도 못 찾았다(다운로드를 못 누름)
// 줄 찾기는 <tr> 에 기대지 않는다(표처럼 보여도 div 로 그린 목록일 수 있음) · "보고서 기간" 칸(날짜 ~ 날짜만 든 칸)에서 위로 올라가
// 상태 글(생성중·생성 완료·실패)까지 함께 든 가장 작은 상자를 그 보고서 한 줄로 본다 · 화면 순서 = 최신이 맨 위
const PERIOD_RE = /^\d{4}-\d{2}-\d{2}\s*[-~]\s*\d{4}-\d{2}-\d{2}$/;
function rowsNow() {
  const out = [];
  for (const cell of document.querySelectorAll('td,div,span,p')) {
    if (!visible(cell) || !PERIOD_RE.test(norm(cell.innerText)) || [...cell.children].some((c) => PERIOD_RE.test(norm(c.innerText)))) continue;
    let r = cell.parentElement;
    while (r && r !== document.body && !/생성|완료|실패|오류/.test(norm(r.innerText))) r = r.parentElement;
    if (r && r !== document.body && !out.includes(r)) out.push(r);
  }
  return out;
}
const ourRows = (job) => rowsNow().filter((r) => { const t = norm(r.innerText); return t.indexOf(job.from) >= 0 && t.indexOf(job.to) >= 0 && /일별/.test(t) && /키워드/.test(t); });
const dlBtn = (r) => [...r.querySelectorAll('button,a,[role=button]')].find((b) => visible(b) && /다운로드|내려받기/.test(norm(b.innerText || b.textContent)) && enabled(b));
async function watchDownload(job) {
  banner('쿠팡이 보고서를 만드는 중 · 다 되면 자동으로 내려받아 ERP 에 넣습니다');
  await status('쿠팡이 보고서를 만드는 중 · 몇 분 걸릴 수 있습니다(창은 그대로 두세요)');
  const before = Array.isArray(job.before) ? job.before.length : (job.before || 0);
  const end = Date.now() + 15 * 60 * 1000;
  let lastReload = Date.now(), lastRefresh = 0, n = 0;
  const t0 = Date.now();
  let lastSig = '', lastChange = Date.now();
  while (Date.now() < end) {
    // 목록은 최신이 맨 위 · 같은 조건의 맨 위 줄이 "생성 완료"면 바로 받는다(사용자 지적: 보고서는 금방 나오는데 한참 뒤에 눌렀다) ·
    // 맨 위가 아직 만드는 중이면 그 줄을 기다린다(옛 줄을 받지 않게)
    // 방금 만든 줄이 아직 목록에 안 보이면(줄 수가 그대로) 20초까지만 기다리고, 그 뒤에는 맨 위 완료 줄을 받는다
    const rows = ourRows(job), top = rows[0];
    const ready = rows.length > before || Date.now() - t0 > 20000;
    if (ready && top && /완료/.test(norm(top.innerText)) && dlBtn(top)) {
      // 확장이 누른 클릭은 사람이 누른 것으로 치지 않아 팝업 다운로드가 막힐 수 있다 · 누르기 직전 표시를 남겨 새 창 주소를 가로챈다
      document.documentElement.dataset.baroyamDl = String(Date.now());
      const b = dlBtn(top);
      ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach((k) => b.dispatchEvent(new MouseEvent(k, { bubbles: true, cancelable: true, view: window })));
      b.click();
      banner('내려받는 중 · ERP 로 보냅니다');
      await status('보고서가 나왔습니다 · 내려받아 ERP 로 보내는 중');
      // 10초 안에 내려받기가 시작되지 않으면 사람에게 다운로드 한 번만 눌러 달라고 한다(그다음은 자동)
      await sleep(10000);
      const me = await send({ type: 'whoami' });
      if (me && me.isJob && !me.gotDl) {
        banner('"다운로드"를 한 번만 눌러 주세요 · 나머지는 자동으로 ERP 에 들어갑니다', 'hand');
        await status('쿠팡이 자동 다운로드를 막았습니다 · 쿠팡 창에서 "다운로드"를 한 번만 눌러 주세요(그다음은 자동)');
        await send({ type: 'show' });
      }
      return;
    }
    if (++n % 12 === 0) await status('쿠팡이 보고서를 만드는 중 · ' + Math.max(1, Math.round((Date.now() - job.startedAt) / 60000)) + '분째 · 목록에서 이 조건 줄 ' + rows.length + '개' + (top ? ' · 맨 위 상태 ' + ((norm(top.innerText).match(/생성 ?중|생성 ?완료|실패|오류/) || ['?'])[0]) : ''));
    // "목록 새로 고침"을 10초마다 · 그 단추가 없으면 40초마다 화면을 새로 연다(이 코드가 다시 돌아 이어서 기다림)
    // "목록 새로 고침"은 만드는 동안 흐리게 잠긴다(쿠팡이 스스로 목록을 바꿈) · 눌리는 때만 4초마다 누르고,
    // 1분 넘게 아무것도 안 바뀌면 화면을 새로 연다(이 코드가 다시 돌아 이어서 기다림)
    const re = findText(/^(목록 ?)?새로 ?고침$/, 'button,a,[role=button]');
    if (re && enabled(re) && Date.now() - lastRefresh > 4000) { re.click(); lastRefresh = Date.now(); }
    const sig = top ? norm(top.innerText) : '';
    if (sig !== lastSig) { lastSig = sig; lastChange = Date.now(); }
    if (Date.now() - lastChange > 60000 && Date.now() - lastReload > 60000) { location.reload(); return; }
    await sleep(1500);
  }
  return hand('보고서가 15분 안에 다 만들어지지 않았습니다');
}

// 가로챈 새 창 주소 → 확장이 직접 내려받기
document.addEventListener('baroyam-open', (e) => { if (e.detail) send({ type: 'dl', url: e.detail }); });

// background · blob: 다운로드는 이 페이지만 읽을 수 있어 여기서 받아 넘긴다
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'grab') return;
  fetch(msg.url, { credentials: 'include' }).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }).then((buf) => {
    let s = ''; const b = new Uint8Array(buf);
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    sendResponse({ ok: true, b64: btoa(s) });
  }).catch((e) => sendResponse({ ok: false, message: e.message }));
  return true;
});

(async () => {
  const me = await send({ type: 'whoami' });
  if (!me || !me.isJob || me.kind !== 'coupang') return;
  try { await run(me); } catch (e) { hand('자동 진행이 멈췄습니다(' + e.message + ')'); }
})();
