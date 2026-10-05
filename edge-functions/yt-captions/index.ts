// 영상분석 AI 용 · 유튜브 영상의 자막(CC)을 받아 [{t(초), text}] 로 돌려준다.
// 브라우저는 유튜브에 직접 못 물어보므로(CORS) 이 함수가 대신 받는다.
// Supabase Edge Function `yt-captions` · 로그인한 사람(대시보드 세션)만 부를 수 있다.
// 이 프로젝트의 로그인 토큰은 새 서명 키(ECC)라 함수 설정의 "레거시 비밀키로 JWT 확인"을 통과하지 못한다 →
// 그 설정은 끄고, 아래 signedIn() 이 Supabase Auth 에 토큰을 직접 물어 확인한다.
// 배포: 이 폴더를 supabase/functions/yt-captions 로 복사한 뒤
//   npx supabase functions deploy yt-captions --no-verify-jwt --project-ref cbwoybtltebmiizzeojn
// 유튜브 웹 플레이어 자막 주소는 2025년부터 추가 토큰이 필요해, 안드로이드 앱 방식(ANDROID 클라이언트)으로 받는다.

const ALLOW = ["https://erp.baroyam.com", "https://caffeinnos1-ai.github.io"];
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin":
    origin && (ALLOW.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) ? origin : ALLOW[0],
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Vary": "Origin",
});

// 클라우드 서버 IP 는 유튜브가 로봇으로 보고 막기도 해서(LOGIN_REQUIRED), 앱 방식 여러 개를 차례로 시도한다
const CLIENTS: { name: string; client: Record<string, unknown>; ua: string }[] = [
  { name: "ANDROID", ua: "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip",
    client: { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 30 } },
  { name: "IOS", ua: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
    client: { clientName: "IOS", clientVersion: "20.10.4", deviceMake: "Apple", deviceModel: "iPhone16,2", osName: "iPhone", osVersion: "18.3.2.22D82" } },
];

// 방문자 표식(visitorData) · 처음 보는 방문자로 막힐 때 붙이면 통과하는 경우가 있다
async function visitorData(): Promise<string> {
  try {
    const t = await (await fetch("https://www.youtube.com/sw.js_data", { headers: { "user-agent": "Mozilla/5.0" } })).text();
    return decodeURIComponent(JSON.parse(t.replace(/^\)\]\}'/, ""))[0][2][0][0][13] || "");
  } catch { return ""; }
}

async function player(v: string, c: typeof CLIENTS[number], vd: string) {
  const r = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": c.ua, ...(vd ? { "x-goog-visitor-id": vd } : {}) },
    body: JSON.stringify({ context: { client: { ...c.client, hl: "ko", gl: "KR", ...(vd ? { visitorData: vd } : {}) } }, videoId: v }),
  });
  return await r.json();
}

type Track = { baseUrl: string; languageCode: string; kind?: string; name?: { runs?: { text: string }[]; simpleText?: string } };

// 한국어 직접 자막 → 한국어 자동 자막 → 다른 언어 직접 자막 → 아무거나
function pick(tracks: Track[]): Track | undefined {
  const ko = (t: Track) => t.languageCode.startsWith("ko");
  const asr = (t: Track) => t.kind === "asr";
  return tracks.find((t) => ko(t) && !asr(t)) || tracks.find(ko) || tracks.find((t) => !asr(t)) || tracks[0];
}

// 대시보드 세션 토큰이 살아 있는 로그인인지 Supabase Auth 에 묻는다(익명 키·만료 토큰은 거절)
async function signedIn(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  const apikey = req.headers.get("apikey") || "";
  if (!/^Bearer\s+\S+\.\S+\.\S+$/.test(auth) || !apikey) return false;
  const r = await fetch(Deno.env.get("SUPABASE_URL") + "/auth/v1/user", { headers: { authorization: auth, apikey } });
  if (!r.ok) return false;
  const u = await r.json().catch(() => null);
  return !!(u && u.id && !u.is_anonymous);
}

Deno.serve(async (req) => {
  const h = { ...cors(req.headers.get("origin")), "content-type": "application/json; charset=utf-8" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: h });
  if (!(await signedIn(req))) return out({ error: "unauthorized", message: "대시보드에 로그인한 뒤 다시 시도해 주세요." }, 401);

  const v = new URL(req.url).searchParams.get("v") || "";
  if (!/^[\w-]{11}$/.test(v)) return out({ error: "bad_id", message: "영상 주소를 확인해 주세요." }, 400);

  try {
    // 방식마다 [표식 없이 → 표식 붙여] 시도 · 영상 정보(OK)를 받으면 멈춘다
    let pj: any = null, used: typeof CLIENTS[number] | null = null, vd = "";
    const tried: string[] = [];
    for (const withVd of [false, true]) {
      if (withVd) vd = await visitorData();
      if (withVd && !vd) break;
      for (const c of CLIENTS) {
        const j = await player(v, c, withVd ? vd : "").catch(() => null);
        const st = j?.playabilityStatus?.status || "ERR";
        tried.push(c.name + (withVd ? "+vd" : "") + ":" + st);
        if (st === "OK") { pj = j; used = c; break; }
      }
      if (pj) break;
    }
    if (!pj || !used) {
      return out({ error: "unplayable", message: "유튜브가 이 영상 정보를 주지 않았습니다(" + tried.join(", ") + ").", tried }, 502);
    }
    const tracks: Track[] = pj?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const tr = pick(tracks);
    if (!tr) return out({ error: "no_captions", message: "이 영상에는 자막(CC)이 없습니다." }, 404);

    const cr = await fetch(tr.baseUrl.replace(/&fmt=[^&]*/, "") + "&fmt=json3", { headers: { "user-agent": used.ua } });
    const cj = await cr.json();
    const segments = (cj.events || [])
      .filter((e: any) => Array.isArray(e.segs))
      .map((e: any) => ({
        t: Math.round((e.tStartMs || 0) / 100) / 10,
        text: e.segs.map((s: any) => s.utf8 || "").join("").replace(/\s+/g, " ").trim(),
      }))
      .filter((s: any) => s.text);
    if (!segments.length) return out({ error: "no_captions", message: "자막이 비어 있습니다." }, 404);

    return out({
      v,
      lang: tr.languageCode,
      auto: tr.kind === "asr",
      title: pj?.videoDetails?.title || "",
      via: used.name + (vd ? "+vd" : ""),
      segments,
    });
  } catch (e) {
    return out({ error: "fetch_failed", message: "자막을 받는 중 오류가 났습니다.", detail: String(e) }, 502);
  }
});
