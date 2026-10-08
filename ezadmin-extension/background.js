// 김비서AI 확장프로그램 · 심부름꾼
// 대시보드(dashboard.js)가 "시작"을 보내면 이지어드민 현 재고조회를 최소화된 창으로 열고,
// (kind 'sales' 이면 그 창에서 정산통계 > 당일판매분요약표로 넘어가 읽는다 · 1.2.0~)
// 로그인이 필요할 때만 그 창을 앞으로 띄운다 · 로그인되면 다시 내리고, 그 창(ezadmin.js)이 읽은 표를
// 대시보드 탭으로 넘긴다 · 저장이 끝나면 이지어드민 창을 닫는다.
// 1.3.0~1.4.0 에 창이 번쩍이지 않게 대시보드 창 안의 접힌 탭 묶음에서 돌렸으나, 크롬이 안 보이는 탭을 거의 멈추다시피 늦춰
// 사람이 그 탭을 눌러야 수집이 끝났다(사용자 지적) · 사용자가 "빠르기"를 골라 1.4.1 에 최소화 창으로 되돌렸다(누를 때 창이 잠깐 보임).
// 지금 하는 일(어느 창·어느 대시보드 탭)은 서비스 워커가 잠들어도 남도록 storage.session 에 둔다.

const I100_URL = 'https://ga83.ezadmin.co.kr/template35.htm?template=I100';
const JOB_TTL_MS = 10 * 60 * 1000; // 로그인 기다림까지 넉넉히 10분

const getJob = async () => {
  const { job } = await chrome.storage.session.get('job');
  if (job && Date.now() - job.startedAt > JOB_TTL_MS) {
    await chrome.storage.session.remove('job');
    return null;
  }
  return job || null;
};
const setJob = (job) => chrome.storage.session.set({ job });
const endJob = () => chrome.storage.session.remove('job');

const toDashboard = (job, msg) => chrome.tabs.sendMessage(job.dashTabId, msg).catch(() => {});

// 이지어드민 페이지 쪽(MAIN world)에서 글자로 찾은 메뉴·단추를 차례로 누른다 · 이지어드민 메뉴는 javascript: 링크라
// 확장 스크립트(ezadmin.js)가 누르면 크롬 보안 규칙(CSP)이 막는다(2026-10-08 오류 · 당일판매분요약표로 못 넘어감) ·
// 페이지 쪽에서 누르면 사람이 누른 것과 같다 · f2: 하나도 못 찾으면 F2 키를 페이지에 보낸다(검색)
async function pageClick(patterns, visible, f2) {
  const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const find = (src) => {
    const re = new RegExp(src);
    return [...document.querySelectorAll('a,li,span,div,button,input[type=button]')]
      .find((e) => re.test(norm(e.innerText || e.value || e.textContent)) && !e.querySelector('a,li,button') && (!visible || e.offsetParent !== null));
  };
  // "함수이름(인자, 인자)" 한 번 부르기 · 인자는 글자('…'·"…")·숫자·true/false/null 만 · 되면 true
  const callCode = (code) => {
    const m = String(code).match(/^\s*([\w$.]+)\s*\(([\s\S]*)\)\s*$/);
    if (!m) return false;
    let fn = window, self = window;
    for (const k of m[1].split('.')) { self = fn; fn = fn && fn[k]; }
    if (typeof fn !== 'function') return false;
    const args = [], re = /\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?|true|false|null)\s*(,|$)/y;
    const body = m[2].trim();
    let pos = 0;
    while (body && pos < body.length) {
      re.lastIndex = pos;
      const t = re.exec(body);
      if (!t) return false;
      const v = t[1];
      args.push(/^['"]/.test(v) ? v.slice(1, -1).replace(/\\(.)/g, '$1') : v === 'true' ? true : v === 'false' ? false : v === 'null' ? null : Number(v));
      pos = re.lastIndex;
      if (!t[2]) break;
    }
    fn.apply(self, args);
    return true;
  };
  const clicked = [];
  // 마지막 것(가려는 메뉴)이 이미 문서에 있으면 그것만 누른다 · 위 메뉴(정산통계)를 먼저 누르면 그쪽으로 넘어가 버릴 수 있다
  const last = patterns[patterns.length - 1];
  const direct = last && find(last);
  for (const src of direct ? [last] : patterns) {
    const el = src === last && direct ? direct : find(src);
    if (!el) continue;
    // javascript: 링크는 누르지 않는다 · 확장이 일으킨 javascript: 이동은 MAIN world 에서도 크롬이 막는다(2026-10-08 두 번째 오류) ·
    // 대신 링크에 적힌 함수 부르기(예: move_page35('X'))를 페이지의 함수로 직접 부른다 · 주소 이동이 아니라 막히지 않는다
    const a = el.closest('a') || el;
    const href = (a.getAttribute && a.getAttribute('href')) || '';
    if (/^javascript:/i.test(href)) {
      const code = href.replace(/^javascript:\s*/i, '').replace(/;\s*$/, '');
      // javascript:void(0) 처럼 아무것도 안 하는 링크는 실제 동작이 누름 처리기(onclick)에 있다(2026-10-08 이지어드민 메뉴) ·
      // 눌러서 처리기는 돌리되, 막히는 javascript: 이동만 먼저 취소한다(원래 아무것도 안 하는 이동이라 잃는 것이 없다)
      const noop = !code || /^void\s*\(?\s*0\s*\)?$/i.test(code) || code === 'return false' || code === 'false';
      if (noop) {
        a.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true });
        a.click();
      } else if (!callCode(code)) { clicked.push('?' + code); continue; }
    } else {
      a.click();
    }
    clicked.push(src);
    if (src !== last) await sleep(1200);   // 마지막 클릭 뒤에는 기다리지 않는다(페이지가 넘어가면 이 스크립트가 끊긴다)
  }
  if (!clicked.length && f2) {
    const $ = window.jQuery;
    if ($) $(document).trigger($.Event('keydown', { keyCode: 113, which: 113, key: 'F2' }));
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', code: 'F2', bubbles: true }));
  }
  return clicked;
}

const WIN_SIZE = { width: 1100, height: 820 };
// 사람이 봐야 할 때(로그인·실패) · 창을 앞으로
const showWin = (job) => chrome.windows.update(job.winId, { state: 'normal', focused: true, ...WIN_SIZE }).catch(() => {});
// 로그인이 끝나면 · 창을 다시 내리고 대시보드를 앞으로
async function hideWin(job) {
  const win = await chrome.windows.get(job.winId).catch(() => null);
  if (!win || win.state === 'minimized') return;
  await chrome.windows.update(job.winId, { state: 'minimized' }).catch(() => {});
  chrome.tabs.get(job.dashTabId).then((t) => chrome.windows.update(t.windowId, { focused: true })).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const tabId = sender.tab && sender.tab.id;

    // 대시보드 · 어드민 수집 단추
    if (msg.type === 'start') {
      try {
        const old = await getJob();
        if (old) { await endJob(); await chrome.windows.remove(old.winId).catch(() => {}); }
        // 당일판매는 한 번 찾아간 요약표 주소를 기억해 두었다가 바로 연다(현 재고조회 → 메뉴 이동을 건너뜀 · 1.3.5~)
        const { salesUrl } = await chrome.storage.local.get('salesUrl');
        const url = msg.kind === 'sales' && salesUrl ? salesUrl : I100_URL;
        const win = await chrome.windows.create({ url, type: 'normal', state: 'minimized', focused: false });
        const tab = win.tabs[0];
        await setJob({ winId: win.id, tabId: tab.id, dashTabId: tabId, startedAt: Date.now(), kind: msg.kind === 'sales' ? 'sales' : 'inventory', shipped: null, moves: 0 });
        quiet(tab.id, 0);   // 첫 화면이 이미 열리기 시작했으면 여기서도 한 번
        sendResponse({ ok: true });
      } catch (e) {
        // 시작부터 실패하면 대시보드 게이지가 계속 돌지 않게 이유를 돌려준다
        sendResponse({ ok: false, message: '이지어드민을 열지 못했습니다 · ' + e.message });
      }
      return;
    }

    // 이지어드민 창 · "내가 수집할 창인가?"
    if (msg.type === 'whoami') {
      const job = await getJob();
      const isJob = !!job && job.tabId === tabId;
      sendResponse({ isJob, kind: isJob ? job.kind || 'inventory' : null, shipped: isJob ? job.shipped : null, moves: isJob ? job.moves || 0 : 0 });
      return;
    }

    const job = await getJob();
    if (!job || job.tabId !== tabId) { sendResponse({ ok: false }); return; }

    // 이지어드민 탭 · 로그인 화면이면 창으로 꺼내 앞에 띄우고, 로그인이 끝나면 다시 접힌 묶음으로 돌려놓은 뒤 대시보드를 앞으로
    if (msg.type === 'show') {
      await showWin(job);
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'hide') {
      await hideWin(job);
      sendResponse({ ok: true });
      return;
    }

    // 이지어드민 창 · 당일판매 · 메인 화면에서 읽은 배송(금일) 숫자 / 메뉴 이동 횟수(같은 곳을 맴돌지 않게)를 기억해 둔다
    if (msg.type === 'meta') {
      if (msg.shipped !== undefined) job.shipped = msg.shipped;
      if (msg.moved) job.moves = (job.moves || 0) + 1;
      if (msg.salesUrl && /^https:\/\/[\w.-]+\.ezadmin\.co\.kr\/template35\.htm\?template=/.test(msg.salesUrl)) await chrome.storage.local.set({ salesUrl: msg.salesUrl });
      await setJob(job);
      sendResponse({ ok: true, moves: job.moves || 0 });
      return;
    }

    // 이지어드민 탭 · 페이지 쪽에서 눌러 달라는 부탁
    if (msg.type === 'mainClick') {
      try {
        const [res] = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: pageClick, args: [msg.patterns || [], !!msg.visible, !!msg.f2] });
        sendResponse({ ok: true, clicked: (res && res.result) || [] });
      } catch (e) {
        sendResponse({ ok: false, clicked: [], message: e.message });
      }
      return;
    }

    // 이지어드민 창 · 지금 단계 알림(로그인 기다림·검색 중 …) → 대시보드 안내 줄
    if (msg.type === 'status') {
      toDashboard(job, { type: 'status', message: msg.message });
      sendResponse({ ok: true });
      return;
    }

    // 이지어드민 창 · 읽은 표 → 대시보드가 저장하고 결과를 돌려준다
    if (msg.type === 'rows' || msg.type === 'error') {
      const reply = await chrome.tabs.sendMessage(job.dashTabId, { ...msg, kind: job.kind || 'inventory', shipped: msg.shipped != null ? msg.shipped : job.shipped }).catch(() => null);
      if (reply && reply.ok) {
        await endJob();
        await chrome.windows.remove(job.winId).catch(() => {});
        chrome.tabs.update(job.dashTabId, { active: true }).catch(() => {});
        chrome.tabs.get(job.dashTabId).then((t) => chrome.windows.update(t.windowId, { focused: true })).catch(() => {});
      }
      // 실패하면 사람이 무슨 일인지 볼 수 있게 이지어드민 탭을 창으로 꺼내 앞에 띄워 둔다
      if (!reply || !reply.ok) await showWin(job);
      sendResponse(reply || { ok: false, message: '대시보드 창을 찾지 못했습니다 · 대시보드에서 어드민 수집을 다시 눌러 주세요.' });
      return;
    }
    sendResponse({ ok: false });
  })();
  return true; // sendResponse 를 나중에 부른다
});

// 사람이 이지어드민 탭(또는 꺼낸 창)을 닫으면 일을 끝내고 대시보드에 알린다 · 창 사이를 옮기는 것은 닫는 것이 아니다(onRemoved 가 오지 않음)
// ---------- 수집 탭의 안내창(alert·confirm·prompt) 막기 ----------
// 크롬은 안 보이는 탭의 안내창을 그 탭을 열 때까지 미뤄 두고, 그동안 페이지 코드는 멈춰 기다린다 ·
// 이지어드민은 조회 중에 안내창을 띄우는 일이 있어(VPS 수집 코드도 안내창을 닫는다) 사람이 수집 탭을 클릭해야 수집이 이어졌다(2026-10-08) ·
// 수집 탭에서만 안내창을 띄우지 않고 넘긴다(확인창은 "확인") · 내용은 ezadmin.js 가 받아 대시보드 안내 줄에 보인다 ·
// 사람이 평소 여는 이지어드민 창은 건드리지 않는다(삭제 확인 같은 창이 저절로 눌리면 안 되므로)
function quietDialogs() {
  if (window.__baroyamQuiet) return;
  window.__baroyamQuiet = true;
  const tell = (kind, m) => document.dispatchEvent(new CustomEvent('baroyam-dialog', { detail: kind + ' · ' + String(m == null ? '' : m) }));
  window.alert = (m) => { tell('안내', m); };
  window.confirm = (m) => { tell('확인', m); return true; };
  window.prompt = (m) => { tell('입력', m); return null; };
}
function quiet(tabId, frameId) {
  chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, world: 'MAIN', injectImmediately: true, func: quietDialogs }).catch(() => {});
}
// 수집 탭의 화면(틀 포함)이 새로 열릴 때마다 페이지 코드보다 먼저 넣는다
chrome.webNavigation.onCommitted.addListener(async (d) => {
  const job = await getJob();
  if (job && job.tabId === d.tabId) quiet(d.tabId, d.frameId);
});

chrome.tabs.onRemoved.addListener(async (closedTabId) => {
  const job = await getJob();
  if (!job || job.tabId !== closedTabId) return;
  await endJob();
  toDashboard(job, { type: 'status', message: '이지어드민 창을 닫아 수집을 멈췄습니다', done: true });
});
