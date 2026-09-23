# 이 저장소 규칙

`index.html`(바로얌 대시보드)의 **유일한 원본**은 이 저장소(`caffeinnos1-ai/baroyam-report`)의 `main` 뿐입니다.
집과 회사 두 대의 PC가 GitHub를 통해서만 이어지므로, 사본이 생기면 나중 작업이 조용히 사라집니다.

## 지켜야 할 것

- 다른 저장소(`baroyam-week` 등)에 `index.html` 을 만들거나 복사하지 않습니다. 2026-09-23에 전부 정리했습니다.
- 새 브랜치를 만들지 않고 `main` 에서만 작업합니다. 브랜치에 남은 작업도 사본과 똑같이 유실됩니다.
- 작업을 시작하기 전에 `git pull`, 자리를 뜨기 전에 `git commit` + `git push` 를 합니다.
- Apps Script(`clasp`)는 데이터 API 전용입니다. 사용자가 실제로 보는 화면은 GitHub Pages
  (`https://caffeinnos1-ai.github.io/baroyam-report/`)이며 푸시 후 1~2분이면 반영됩니다.

## 창을 여러 개 띄워 쓰고 있습니다

사용자는 이 폴더에서 AI 창(Claude·Codex)을 **동시에 여러 개** 씁니다. 다른 창이 `index.html` 을
고치는 중일 수 있으므로, 내가 만들지 않은 변경을 덮거나 삼키지 않도록 합니다.

- **커밋할 때 `git add -A` / `git add .` 를 쓰지 않습니다.** 내가 만진 파일만 경로로 지정해 담습니다.
- 커밋 전에 `git status --short` 로 내가 만지지 않은 파일이 올라와 있는지 봅니다.
  있으면 그 파일은 빼고, 사용자에게 "다른 창의 작업으로 보인다"고 알립니다.
- 파일 전체를 새로 쓰기보다 고칠 부분만 고칩니다. 전체 덮어쓰기는 다른 창의 편집을 지웁니다.
- 이미 다른 창의 작업을 커밋해 푸시했다면 **되돌리지 않습니다.** 그 커밋 위에서 다른 창이
  계속 일하고 있을 수 있습니다. 사용자에게 알리고 그대로 둡니다.

## UI 부품 규칙 (버튼·탭·칩·입력칸·날짜선택)

화면마다 `mh-btn`·`ag-btn`·`hero-view-tab`·`ag-calendar`·`pjf-cal` 처럼 부품을 새로 만들다 보니
모양이 제각각이 되었습니다. **새로 만드는 화면·기능은 아래 표준 부품만 씁니다.**
정의는 `index.html` 의 `/* ===== 표준 UI 부품 (ui-*)` CSS 와 `window.UI` 스크립트이고,
모양 견본은 `ui-sample.html` 입니다 (GitHub Pages 에서 `/baroyam-report/ui-sample.html`).

| 용도 | 쓸 것 |
|---|---|
| 버튼 | `<button class="ui-btn">` + `primary` / `soft` / `ghost` / `danger`, 크기 `sm`, 아이콘만 `icon`, 꽉 채움 `block` |
| 보기 전환 탭 | `<div class="ui-tabs">` 안에 `<button class="ui-tab" data-value="…">`, 동작은 `UI.tabs(상자, 함수)` |
| 필터 칩 | `<div class="ui-chips">` 안에 `<button class="ui-chip" aria-pressed="true/false">`, 숫자는 `<b>` |
| 입력칸·선택칸 | `<input class="ui-field">`, 목록을 여는 버튼도 `class="ui-field"` |
| 날짜·기간 선택 | 빈 `<button>` 에 `UI.datePicker(버튼, {mode:'single'｜'range', value, presets, max, onChange})` · 기간은 프로젝트 마감일 고르기와 같은 모양(빠른 선택 → 시작일~종료일 → 달력 → 초기화/적용), 대시보드 머리 위 버튼은 `class="raised"` |
| 떠 있는 메뉴 | `class="ui-pop"` |

- 새 `xx-btn`·`xx-tab`·`xx-chip`·`xx-cal` 클래스를 만들지 않습니다. 필요한 변형은 `ui-*` 에 수식 클래스로 추가하고
  `ui-sample.html` 에도 한 줄 넣습니다.
- `<input type="date">` 와 새 달력 코드를 만들지 않습니다. 브라우저마다 모양이 다르고 다크 모드와 어긋납니다.
- 색은 `--btn` / `--btn-hover` / `--btn-soft` / `--btn-soft-ink` 와 `--ink`·`--body`·`--mute`·`--line`·`--paper` 만 씁니다.
  `#e2672a` 같은 색 코드를 직접 쓰지 않습니다. 그래야 다크 모드에서 자동으로 파란 계열로 바뀝니다.
- 크기·둥글기는 `--ui-h`(36px) / `--ui-h-sm`(30px) / `--ui-r` 를 따릅니다.
- 한 영역에 `primary` 버튼은 하나만 둡니다.
- 기존 부품(`mh-btn` 등)은 **일부러 한꺼번에 바꾸지 않습니다.** 그 화면을 고칠 일이 생겼을 때 그 화면만 `ui-*` 로 옮깁니다.

## 과거에 일어난 일

- 2026-09-22 집에서 한 필터 작업이 `baroyam-week` 의 옛 브랜치로 들어가 이 저장소에서 보이지
  않았습니다 (`492f18a` → 이 저장소 `15f1a89` 로 복구). 같은 파일이 두 저장소에 있던 것이 원인이었습니다.
- 2026-09-23 한 창이 `git add -A` 로 커밋하면서 다른 창이 작성 중이던 상담 콘솔 퀵링크 작업을
  엉뚱한 커밋(`e26ad0d`)에 함께 올렸습니다. 내용은 남았지만 이력이 어긋났습니다.

---

이 파일은 이 저장소에서 일하는 모든 AI 도구(Codex·Claude 등)가 읽는 공통 규칙입니다.
`CLAUDE.md` 는 이 파일을 가리키기만 하므로, 규칙을 고칠 때는 **이 파일만** 고치면 됩니다.
