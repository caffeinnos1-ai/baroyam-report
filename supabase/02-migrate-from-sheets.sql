-- 바로얌 대시보드 · 구글시트에 있던 나머지 데이터를 Supabase로 옮기기 위한 스키마
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run(Ctrl+Enter).
-- 여러 번 실행해도 안전하다(있으면 건너뛴다).
--
-- 접근 권한은 기존 notes_allowed 와 똑같은 방식으로 건다 ·
-- 로그인한 사용자 중 is_baroyam_user() 를 통과한 사람만. 익명은 정책이 없어 기본 거부.

---------------------------------------------------------------------------
-- 1) projects · 앱이 쓰는데 테이블에 없던 두 컬럼
--    owner   = 담당자 이름 ("내 담당" 판정에 이름을 쓴다)
--    channel = 판매채널 (채널별 프로젝트 화면이 이 값으로 거른다)
---------------------------------------------------------------------------
alter table public.projects add column if not exists owner   text;
alter table public.projects add column if not exists channel text;

---------------------------------------------------------------------------
-- 2) app_settings · 문서형 데이터를 담는 범용 칸
--    목표설정(goal) · 보고서 섹션01 메모(section01) · 주간 실행계획(weekplan)
--    메뉴얼가이드 목차(manualGuide) · 메뉴얼 문서(guideDoc:<id>) · 카테고리설정(categories)
--    이 값들은 화면 한 벌 단위의 문서라서 행으로 쪼개면 오히려 다루기 어렵다.
---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now()
);

---------------------------------------------------------------------------
-- 3) agenda_items · 회의안건
--    지금은 앱스크립트가 메인 탭 / 휴지통 탭으로 행을 옮겨 휴지통을 구현한다 ·
--    여기서는 trashed 플래그 하나로 대신한다.
---------------------------------------------------------------------------
create table if not exists public.agenda_items (
  id           text primary key,
  meeting_date date,
  topic        text,
  category     text,
  note_html    text,
  notes_html   text,
  trashed      boolean     not null default false,
  trashed_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists agenda_items_live_idx
  on public.agenda_items (trashed, meeting_date desc);

---------------------------------------------------------------------------
-- 4) 접근 정책 · notes_allowed 와 같은 모양으로 새 테이블에도 건다
---------------------------------------------------------------------------
alter table public.app_settings enable row level security;
drop policy if exists app_settings_allowed on public.app_settings;
create policy app_settings_allowed on public.app_settings
  for all to authenticated
  using (public.is_baroyam_user()) with check (public.is_baroyam_user());

alter table public.agenda_items enable row level security;
drop policy if exists agenda_items_allowed on public.agenda_items;
create policy agenda_items_allowed on public.agenda_items
  for all to authenticated
  using (public.is_baroyam_user()) with check (public.is_baroyam_user());

-- 기존 네 테이블에도 같은 정책이 걸려 있는지 확인하고, 없으면 건다.
-- (notes 는 이미 notes_allowed 가 있으므로 그대로 둔다)
alter table public.members     enable row level security;
alter table public.projects    enable row level security;
alter table public.quick_links enable row level security;
alter table public.notes       enable row level security;

drop policy if exists members_allowed on public.members;
create policy members_allowed on public.members
  for all to authenticated
  using (public.is_baroyam_user()) with check (public.is_baroyam_user());

drop policy if exists projects_allowed on public.projects;
create policy projects_allowed on public.projects
  for all to authenticated
  using (public.is_baroyam_user()) with check (public.is_baroyam_user());

drop policy if exists quick_links_allowed on public.quick_links;
create policy quick_links_allowed on public.quick_links
  for all to authenticated
  using (public.is_baroyam_user()) with check (public.is_baroyam_user());

---------------------------------------------------------------------------
-- 5) 결과 확인
---------------------------------------------------------------------------
select tablename as "테이블", policyname as "정책", roles as "역할", qual as "조건"
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
