-- KEYNIVERSE 스위치 핀(0/2/3/5핀) 및 스프링(3단) 제약 확장 마이그레이션
-- Supabase SQL Editor에서 1회 실행하세요.

alter table public.switches
  drop constraint if exists switches_pins_check;

alter table public.switches
  add constraint switches_pins_check
  check (pins in (0, 2, 3, 5));

alter table public.switches
  drop constraint if exists switches_spring_type_check;

alter table public.switches
  add constraint switches_spring_type_check
  check (spring_type is null or spring_type in ('1단', '2단', '3단'));
