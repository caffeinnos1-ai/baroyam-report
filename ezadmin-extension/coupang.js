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
function setPeriod(from, to) {
  // 1) 빠른 선택에 "이번 달"(당월)이 있으면 그것 · 2) 날짜 칸 두 개에 직접
  const quick = findText(/^(이번 ?달|당월|이번달|이번 달 1일부터)$/);
  if (quick) { press(quick); return true; }
  const ins = [...document.querySelectorAll('input')].filter((i) => visible(i) && /\d{4}[.\-/]\d{2}[.\-/]\d{2}/.test(i.value || i.placeholder || ''));
  if (ins.length >= 2) {
    const fmt = (d) => { const s = ins[0].value || ins[0].placeholder || ''; const sep = (s.match(/\d{4}([.\-/])/) || [])[1] || '-'; return d.split('-').join(sep); };
    setInput(ins[0], fmt(from)); setInput(ins[1], fmt(to)); return true;
  }
  return false;
}

let handMode = false;
async function hand(why) {
  if (handMode) return; handMode = true;
  banner('이 창에서 보고서를 직접 만들고 "다운로드"만 눌러 주세요 · 내려받은 파일은 자동으로 ERP 에 들어갑니다', 'hand');
  await status((why ? why + ' · ' : '') + '쿠팡 창에서 보고서를 직접 만들고 다운로드만 눌러 주세요(파일은 자동으로 ERP 에 들어갑니다)');
  await send({ type: 'show' });
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
  // 목록 닫기 · Esc + 빈 곳 누르기
  document.activeElement && document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  const title = findText(/^보고서 ?구조$/); if (title) title.click();
  await sleep(500);
  return !/캠페인을 ?선택하세요/.test(norm((holder.closest('div') || holder).innerText || holder.value || ''));
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
  if (!(await waitFor(makeBtn, 20000))) return hand('보고서 만들기 단추를 찾지 못했습니다');
  await sleep(800);
  const miss = [];
  if (!setPeriod(job.from, job.to)) miss.push('기간');
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
  if (miss.includes('모든 캠페인') || !enabled(go)) return hand('못 고른 조건: ' + (miss.join('·') || '보고서 만들기가 눌리지 않음'));
  // 지금 목록에 있는 보고서 줄을 기억 · 새로 생긴 줄을 찾으려고
  const before = rowsNow().map((r) => rowKey(r));
  go.click();
  await send({ type: 'meta', phase: 'download', before });
  job.phase = 'download'; job.before = before;
  if (miss.length) await status('보고서를 요청했습니다(못 고른 조건: ' + miss.join('·') + ' · 쿠팡 기본값으로)');
  return watchDownload(job);
}
// 오른쪽 보고서 목록 · 줄 = 번호 | 기간 | [일별] 구조 | 요청일 | 상태 | 단추
const rowsNow = () => [...document.querySelectorAll('tr')].filter((r) => visible(r) && /\d{4}-\d{2}-\d{2}\s*-\s*\d{4}-\d{2}-\d{2}/.test(r.innerText || ''));
const rowKey = (r) => norm(r.innerText).slice(0, 160);
const dlBtn = (r) => [...r.querySelectorAll('button,a,[role=button]')].find((b) => visible(b) && /다운로드|내려받기/.test(norm(b.innerText || b.textContent)) && enabled(b));
async function watchDownload(job) {
  banner('쿠팡이 보고서를 만드는 중 · 다 되면 자동으로 내려받아 ERP 에 넣습니다');
  await status('쿠팡이 보고서를 만드는 중 · 몇 분 걸릴 수 있습니다(창은 그대로 두세요)');
  const before = new Set(job.before || []);
  const want = (r) => { const t = norm(r.innerText); return t.indexOf(job.from) >= 0 && t.indexOf(job.to) >= 0 && /일별/.test(t) && /키워드/.test(t); };
  const end = Date.now() + 15 * 60 * 1000;
  let lastReload = Date.now(), n = 0;
  while (Date.now() < end) {
    const rows = rowsNow();
    // 새로 생긴 줄 중 우리 조건 줄 · 없으면 우리 조건 줄 아무거나(새로고침 뒤 before 와 글자가 달라졌을 수 있음)
    const mine = rows.filter((r) => want(r) && !before.has(rowKey(r)));
    const cand = mine.length ? mine : rows.filter(want);
    const done = cand.find((r) => /완료/.test(norm(r.innerText)) && dlBtn(r));
    if (done && (mine.length || Date.now() - job.startedAt > 30000)) {
      dlBtn(done).click();
      banner('내려받는 중 · ERP 로 보냅니다');
      await status('보고서가 나왔습니다 · 내려받아 ERP 로 보내는 중');
      return;
    }
    if (++n % 6 === 0) await status('쿠팡이 보고서를 만드는 중 · ' + Math.round((Date.now() - job.startedAt) / 60000) + '분째');
    // 목록이 저절로 안 바뀌면 40초마다 화면을 새로 연다(이 코드가 다시 돌아 이어서 기다림)
    const re = findText(/^(새로 ?고침|목록 ?새로고침)$/, 'button,a,[role=button]');
    if (re) re.click();
    else if (Date.now() - lastReload > 40000) { location.reload(); return; }
    await sleep(5000);
  }
  return hand('보고서가 15분 안에 다 만들어지지 않았습니다');
}

// background · blob: 다운로드는 이 페이지만 읽을 수 있어 여기서 받아 넘긴다
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'grab') return;
  fetch(msg.url).then((r) => r.arrayBuffer()).then((buf) => {
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
