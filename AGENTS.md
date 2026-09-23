# 이 저장소 규칙

`index.html`(바로얌 대시보드)의 **유일한 원본**은 이 저장소(`caffeinnos1-ai/baroyam-report`)의 `main` 뿐입니다.
집과 회사 두 대의 PC가 GitHub를 통해서만 이어지므로, 사본이 생기면 나중 작업이 조용히 사라집니다.

## 지켜야 할 것

- 다른 저장소(`baroyam-week` 등)에 `index.html` 을 만들거나 복사하지 않습니다. 2026-09-23에 전부 정리했습니다.
- 새 브랜치를 만들지 않고 `main` 에서만 작업합니다. 브랜치에 남은 작업도 사본과 똑같이 유실됩니다.
- 작업을 시작하기 전에 `git pull`, 자리를 뜨기 전에 `git commit` + `git push` 를 합니다.
- Apps Script(`clasp`)는 데이터 API 전용입니다. 사용자가 실제로 보는 화면은 GitHub Pages
  (`https://caffeinnos1-ai.github.io/baroyam-report/`)이며 푸시 후 1~2분이면 반영됩니다.

## 과거에 일어난 일

2026-09-22 집에서 한 필터 작업이 `baroyam-week` 의 옛 브랜치로 들어가 이 저장소에서 보이지 않았습니다
(`492f18a` → 이 저장소 `15f1a89` 로 복구). 같은 파일이 두 저장소에 있던 것이 원인이었습니다.

---

이 파일은 이 저장소에서 일하는 모든 AI 도구(Codex·Claude 등)가 읽는 공통 규칙입니다.
`CLAUDE.md` 는 이 파일을 가리키기만 하므로, 규칙을 고칠 때는 **이 파일만** 고치면 됩니다.
