-- 바로얌 대시보드 · notes 테이블 접근 정책 메모
--
-- 결론: 새로 만들 것이 없다. 2026-09-21에 만들어 둔 notes_allowed 정책이 이미 맞다.
--
--   notes_allowed | ALL | {authenticated} | PERMISSIVE | is_baroyam_user() | is_baroyam_user()
--
-- 익명(anon)에게는 아무 정책도 걸려 있지 않으므로 기본 거부다.
-- baroyam-report 저장소와 GitHub Pages가 공개라 publishable 키는 페이지 소스에 드러나지만,
-- 이 정책 덕분에 키만으로는 아무것도 읽을 수 없다. (공개 키로 조회하면 0행이 나오는 게 정상)
--
-- 주의 · PERMISSIVE 정책은 OR로 합쳐진다.
-- "authenticated 에게 using(true)" 같은 정책을 하나라도 더 만들면
-- is_baroyam_user() 검사가 통째로 무력화된다. 아래는 그렇게 잘못 만들었던 것을 되돌리는 문장이다.
drop policy if exists notes_authenticated_all on public.notes;

-- 현재 걸린 정책 확인
select policyname as "정책이름",
       cmd        as "대상동작",
       roles      as "적용역할",
       permissive as "허용방식",
       qual       as "읽기조건",
       with_check as "쓰기조건"
from pg_policies
where schemaname = 'public' and tablename = 'notes'
order by policyname;

-- is_baroyam_user() 가 무엇을 검사하는지 보기
select pg_get_functiondef(p.oid) as "함수정의"
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname = 'is_baroyam_user';
