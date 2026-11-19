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
  const quick = findText(/^(이번 ?달|당월|이번달)$/);
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

async function run(job) {
  const host = location.hostname;
  // 로그인 화면 · 창을 앞으로 띄우고 기다린다(로그인되면 광고센터로 돌아와 이 코드가 다시 돈다)
  if (/xauth|login|wing\./.test(host) || /login|signin/i.test(location.pathname) || document.querySelector('input[type=password]')) {
    banner('쿠팡에 로그인해 주세요 · 로그인되면 자동으로 보고서를 만듭니다');
    await status('쿠팡 로그인을 기다리는 중 · 앞에 뜬 창에서 로그인해 주세요');
    await send({ type: 'show' });
    return;
  }
  if (job.phase === 'download') return watchDownload(job);
  banner('쿠팡 광고 보고서를 만드는 중…');
  await status('쿠팡 광고센터 보고서 화면을 찾는 중');
  // 보고서 화면 찾기 · "보고서 만들기" 단추가 보일 때까지 · 없으면 메뉴의 "보고서"를 누른다(세 번까지)
  let make = await waitFor(() => findText(/^보고서 ?(만들기|생성|요청)$/), 8000);
  if (!make) {
    if ((job.moves || 0) < 3) {
      const nav = findText(/^(광고 ?보고서|보고서)$/, 'a,button,li,span,div');
      if (nav) { await send({ type: 'meta', moved: true }); press(nav); }
      make = await waitFor(() => findText(/^보고서 ?(만들기|생성|요청)$/), 12000);
    }
    if (!make) return hand('보고서 화면을 찾지 못했습니다');
  }
  // 같은 이름 단추가 "새 보고서 창 열기"일 수도 있다 · 누른 뒤 조건 칸이 나오면 그 안에서 고른다
  const formShown = () => findText(/보고서 ?구조|기간 ?구분|집계 ?단위/);
  if (!formShown()) { press(make); await sleep(1500); }
  if (!(await waitFor(formShown, 8000))) return hand('보고서 조건 칸을 찾지 못했습니다');
  await status('보고서 조건을 고르는 중(이번 달 · 일별 · 모든 캠페인 · 키워드)');
  const miss = [];
  if (!setPeriod(job.from, job.to)) miss.push('기간');
  await sleep(500);
  const daily = findText(/^일별$/); if (daily) press(daily); else miss.push('일별');
  await sleep(400);
  const allc = findText(/^(모든|전체) ?캠페인$/); if (allc) press(allc); else miss.push('모든 캠페인');
  await sleep(400);
  const kw = findText(/캠페인.*광고 ?그룹.*상품.*키워드|키워드 ?(보고서|단위)$|^키워드$/); if (kw) press(kw); else miss.push('보고서 구조');
  await sleep(400);
  if (!check(/클릭이 ?발생한 ?키워드/)) miss.push('클릭 발생 키워드만');
  await sleep(600);
  if (miss.length) return hand('못 고른 조건: ' + miss.join('·'));
  const go = [...document.querySelectorAll('button,[role=button],input[type=submit]')].filter((e) => visible(e) && /^보고서 ?(만들기|생성|요청)$|^(만들기|생성|요청|확인)$/.test(norm(e.innerText || e.value))).pop();
  if (!go) return hand('보고서 만들기 단추를 찾지 못했습니다');
  const before = downloadButtons().length;
  go.click();
  await send({ type: 'meta', phase: 'download', before });
  job.phase = 'download'; job.before = before;
  return watchDownload(job);
}
const downloadButtons = () => [...document.querySelectorAll('button,a,[role=button]')].filter((e) => visible(e) && /^(다운로드|내려받기|CSV ?다운로드)$/.test(norm(e.innerText || e.textContent)) && !e.disabled && e.getAttribute('aria-disabled') !== 'true');
async function watchDownload(job) {
  banner('보고서를 만드는 중 · 다 되면 자동으로 내려받습니다');
  await status('쿠팡이 보고서를 만드는 중 · 보통 1~3분');
  const end = Date.now() + 6 * 60 * 1000;
  while (Date.now() < end) {
    const list = downloadButtons();
    // 새로 생긴(또는 맨 위) 다운로드 단추 · 목록은 보통 최신이 맨 위
    if (list.length > (job.before || 0) || (list.length && Date.now() - job.startedAt > 20000)) {
      press(list[0]);
      banner('내려받는 중 · ERP 로 보냅니다');
      await status('보고서를 내려받는 중');
      return;
    }
    // 목록이 저절로 안 바뀌는 화면이면 "새로고침" 단추를 가끔 누른다
    const re = findText(/^(새로 ?고침|목록 ?새로고침)$/, 'button,a,[role=button]');
    if (re) re.click();
    await sleep(5000);
  }
  return hand('보고서가 6분 안에 다 만들어지지 않았습니다');
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
