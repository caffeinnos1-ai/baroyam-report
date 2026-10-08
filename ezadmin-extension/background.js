// 김비서AI 확장프로그램 · 심부름꾼
// 대시보드(dashboard.js)가 "시작"을 보내면 이지어드민 현 재고조회를 대시보드 창 안의 **접힌 탭 묶음**("바로얌 수집")에 열고,
// (kind 'sales' 이면 그 탭에서 정산통계 > 당일판매분요약표로 넘어가 읽는다 · 1.2.0~)
// 로그인이 필요할 때만 그 탭을 따로 창으로 꺼내 앞에 띄운다 · 로그인되면 다시 접힌 묶음으로 돌려놓고, 그 탭(ezadmin.js)이 읽은 표를
// 대시보드 탭으로 넘긴다 · 저장이 끝나면 이지어드민 탭을 닫는다.
// 1.3.0 · 예전에는 최소화된 새 창을 만들었는데, 윈도우가 그 창을 잠깐 그렸다가 내려 로그인돼 있어도 창이 번쩍였다(사용자 지적) ·
// 새 창을 만들지 않으면 번쩍일 것이 없다 · 사람이 로그인해야 할 때만 창이 보인다.
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
      if (!callCode(code)) { clicked.push('?' + code); continue; }
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

// 이지어드민 탭을 대시보드 창의 접힌 묶음에 넣는다(묶음이 접혀 있으면 탭 줄에도 이름표만 남는다)
async function tuck(tabId, windowId) {
  const groupId = await chrome.tabs.group({ tabIds: [tabId], createProperties: { windowId } });
  await chrome.tabGroups.update(groupId, { collapsed: true, title: '바로얌 수집', color: 'orange' }).catch(() => {});
}
// 사람이 봐야 할 때(로그인·실패) · 탭을 따로 창으로 꺼내 앞에 띄운다 · 이미 꺼냈으면 그 창을 앞으로
async function popOut(job) {
  const tab = await chrome.tabs.get(job.tabId).catch(() => null);
  if (!tab) return;
  const dash = await chrome.tabs.get(job.dashTabId).catch(() => null);
  if (dash && tab.windowId !== dash.windowId) {
    await chrome.windows.update(tab.windowId, { state: 'normal', focused: true }).catch(() => {});
    return;
  }
  await chrome.tabs.ungroup(job.tabId).catch(() => {});
  await chrome.windows.create({ tabId: job.tabId, type: 'normal', focused: true, width: 1100, height: 820 }).catch(() => {});
}
// 로그인이 끝나면 · 꺼낸 창에서 다시 대시보드 창의 접힌 묶음으로(창은 탭이 빠지면 저절로 닫힌다)
async function tuckBack(job) {
  const tab = await chrome.tabs.get(job.tabId).catch(() => null);
  const dash = await chrome.tabs.get(job.dashTabId).catch(() => null);
  if (!tab || !dash || tab.windowId === dash.windowId) return;
  await chrome.tabs.move(job.tabId, { windowId: dash.windowId, index: -1 }).catch(() => {});
  await tuck(job.tabId, dash.windowId).catch(() => {});
  await chrome.tabs.update(job.dashTabId, { active: true }).catch(() => {});
  await chrome.windows.update(dash.windowId, { focused: true }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const tabId = sender.tab && sender.tab.id;

    // 대시보드 · 어드민 수집 단추
    if (msg.type === 'start') {
      try {
        const old = await getJob();
        if (old) { await endJob(); await chrome.tabs.remove(old.tabId).catch(() => {}); }
        // 뒤쪽(active:false)으로 열고 곧바로 접힌 묶음에 넣는다 · index 를 주지 않으면 창 맨 끝에 열린다(tabs.create 는 -1 을 받지 않음)
        const windowId = sender.tab.windowId;
        const tab = await chrome.tabs.create({ windowId, url: I100_URL, active: false });
        await setJob({ tabId: tab.id, dashTabId: tabId, startedAt: Date.now(), kind: msg.kind === 'sales' ? 'sales' : 'inventory', shipped: null, moves: 0 });
        await tuck(tab.id, windowId).catch(() => {});
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
      await popOut(job);
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'hide') {
      await tuckBack(job);
      sendResponse({ ok: true });
      return;
    }

    // 이지어드민 창 · 당일판매 · 메인 화면에서 읽은 배송(금일) 숫자 / 메뉴 이동 횟수(같은 곳을 맴돌지 않게)를 기억해 둔다
    if (msg.type === 'meta') {
      if (msg.shipped !== undefined) job.shipped = msg.shipped;
      if (msg.moved) job.moves = (job.moves || 0) + 1;
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
        await chrome.tabs.remove(job.tabId).catch(() => {});
      }
      // 실패하면 사람이 무슨 일인지 볼 수 있게 이지어드민 탭을 창으로 꺼내 앞에 띄워 둔다
      if (!reply || !reply.ok) await popOut(job);
      sendResponse(reply || { ok: false, message: '대시보드 창을 찾지 못했습니다 · 대시보드에서 어드민 수집을 다시 눌러 주세요.' });
      return;
    }
    sendResponse({ ok: false });
  })();
  return true; // sendResponse 를 나중에 부른다
});

// 사람이 이지어드민 탭(또는 꺼낸 창)을 닫으면 일을 끝내고 대시보드에 알린다 · 창 사이를 옮기는 것은 닫는 것이 아니다(onRemoved 가 오지 않음)
chrome.tabs.onRemoved.addListener(async (closedTabId) => {
  const job = await getJob();
  if (!job || job.tabId !== closedTabId) return;
  await endJob();
  toDashboard(job, { type: 'status', message: '이지어드민 창을 닫아 수집을 멈췄습니다', done: true });
});
