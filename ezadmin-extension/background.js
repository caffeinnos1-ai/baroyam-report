// 바로얌 재고 수집 · 심부름꾼
// 대시보드(dashboard.js)가 "시작"을 보내면 이지어드민 현 재고조회를 새 창으로 열고, 그 창(ezadmin.js)이 읽은 표를
// 대시보드 탭으로 넘긴다 · 저장이 끝나면 이지어드민 창을 닫는다.
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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const tabId = sender.tab && sender.tab.id;

    // 대시보드 · 어드민 수집 단추
    if (msg.type === 'start') {
      const old = await getJob();
      if (old) await chrome.windows.remove(old.winId).catch(() => {});
      const win = await chrome.windows.create({ url: I100_URL, type: 'normal', width: 1300, height: 900, focused: true });
      await setJob({ winId: win.id, tabId: win.tabs[0].id, dashTabId: tabId, startedAt: Date.now() });
      sendResponse({ ok: true });
      return;
    }

    // 이지어드민 창 · "내가 수집할 창인가?"
    if (msg.type === 'whoami') {
      const job = await getJob();
      sendResponse({ isJob: !!job && job.tabId === tabId });
      return;
    }

    const job = await getJob();
    if (!job || job.tabId !== tabId) { sendResponse({ ok: false }); return; }

    // 이지어드민 창 · 지금 단계 알림(로그인 기다림·검색 중 …) → 대시보드 안내 줄
    if (msg.type === 'status') {
      toDashboard(job, { type: 'status', message: msg.message });
      sendResponse({ ok: true });
      return;
    }

    // 이지어드민 창 · 읽은 표 → 대시보드가 저장하고 결과를 돌려준다
    if (msg.type === 'rows' || msg.type === 'error') {
      const reply = await chrome.tabs.sendMessage(job.dashTabId, msg).catch(() => null);
      if (reply && reply.ok) {
        await endJob();
        await chrome.windows.remove(job.winId).catch(() => {});
        chrome.tabs.update(job.dashTabId, { active: true }).catch(() => {});
        chrome.tabs.get(job.dashTabId).then((t) => chrome.windows.update(t.windowId, { focused: true })).catch(() => {});
      }
      sendResponse(reply || { ok: false, message: '대시보드 창을 찾지 못했습니다 · 대시보드에서 어드민 수집을 다시 눌러 주세요.' });
      return;
    }
    sendResponse({ ok: false });
  })();
  return true; // sendResponse 를 나중에 부른다
});

// 사람이 이지어드민 창을 닫으면 일을 끝내고 대시보드에 알린다
chrome.windows.onRemoved.addListener(async (winId) => {
  const job = await getJob();
  if (!job || job.winId !== winId) return;
  await endJob();
  toDashboard(job, { type: 'status', message: '이지어드민 창을 닫아 수집을 멈췄습니다', done: true });
});
