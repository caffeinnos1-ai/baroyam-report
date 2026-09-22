# baroyam-report

바로얌 매출·광고 성과 보고서 대시보드. GitHub Pages로 공개된다.

👉 https://caffeinnos1-ai.github.io/baroyam-report/

## index.html은 이 저장소가 유일한 소스다

집이든 회사든 **이 저장소를 클론해서 `index.html`을 고치고 push**한다.
push하면 GitHub Pages가 1~2분 안에 갱신된다. 다른 곳에 사본을 두지 않는다.

예전에는 비공개 저장소 `baroyam-week`의 `report-webapp/index.html`을 고치면
워크플로가 이 파일을 덮어쓰며 발행했다. 2026-09-22에 그 구조를 없앴다 —
두 PC가 GitHub로만 오가는데 같은 파일이 두 저장소에 있으면
한쪽 작업이 조용히 사라지기 때문이다.

## 함께 알아 둘 것

- `automation-status.json`은 `.github/workflows/refresh-status.yml`이 자동으로
  갱신한다. 직접 고치지 않는다.
- 앱스크립트 데이터 API(`Code.js`)와 내부 문서는 비공개 저장소
  `caffeinnos1-ai/baroyam-week`에 있다. **이 저장소는 공개이므로 내부 메모나
  열쇠를 두지 않는다.**
- `index.html`에 들어 있는 Supabase `publishable` 키는 브라우저에 드러나도 되는
  공개 키다. 실제 차단은 Supabase의 RLS 정책이 한다. `secret` 키는 절대
  이 저장소에 두지 않는다.
