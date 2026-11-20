-- ============================================================================
-- KEYNIVERSE 초기 스펙 도감 마스터 데이터 (스위치 11종 · 마우스 10종)
-- schema.sql 실행 후 Supabase SQL Editor에서 실행하세요. (중복 실행 안전)
-- ============================================================================

insert into public.switches (
  id, slug, name, name_en, brand, category,
  operating_force_gf, bottom_out_force_gf, pre_travel_mm, total_travel_mm,
  spring_length_mm, spring_type,
  material_top, material_bottom, material_stem,
  factory_lubed, pins, color_top_hex, color_bottom_hex, color_stem_hex
) values
  ('sw-hmx-hyacinth-v2u', 'hmx-hyacinth-v2u', 'HMX 히야신스 V2U', 'HMX Hyacinth V2U', 'HMX', 'linear', 45, 50, 1.9, 3.5, 22, '1단', 'PC', 'Nylon (PA66)', 'POM (롱폴)', true, 5, '#8D86C9', '#5C5470', '#E4E6E1'),
  ('sw-hmx-cheese', 'hmx-cheese', 'HMX 치즈', 'HMX Cheese Linear', 'HMX', 'linear', 43, 48, 2.0, 3.5, 22, '1단', 'PA12', 'PA66', 'LY', true, 5, '#D4A373', '#C68B59', '#F2D0A9'),
  ('sw-bsun-rosewood', 'bsun-rosewood', 'BSUN 로즈우드', 'BSUN Rosewood', 'BSUN', 'linear', 40, 53, 1.8, 3.6, 21, '1단', 'PC (혼합)', 'Nylon', 'LY', true, 5, '#8C5853', '#593837', '#C99E93'),
  ('sw-gateron-oil-king', 'gateron-oil-king', '게이트론 오일킹', 'Gateron Oil King', 'Gateron', 'linear', 55, 65, 2.0, 4.0, 20, '1단', 'Nylon', 'Ink Nylon', 'POM', true, 5, '#2A2D2B', '#1E201F', '#3E4340'),
  ('sw-cherry-mx2a-black', 'cherry-mx2a-black', '체리 MX2A 흑축', 'Cherry MX2A Black', 'Cherry', 'linear', 60, null, 2.0, 4.0, 18.5, '1단', 'Nylon', 'Nylon', 'POM', true, 5, '#313533', '#232625', '#181A19'),
  ('sw-gazzew-boba-u4t', 'gazzew-boba-u4t', '가쥬 보바 U4T (62g)', 'Gazzew Boba U4T', 'Gazzew', 'tactile', 50, 62, 2.0, 3.4, 19, '1단', 'Gazzew Blend', 'Gazzew Blend', 'POM (롱폴)', true, 5, '#D8D4C8', '#C5C0B2', '#D4A373'),
  ('sw-outemu-silent-peach-v3', 'outemu-silent-peach-v3', '오테뮤 저소음 피치 V3', 'Outemu Silent Peach V3', 'Outemu', 'silent_linear', 40, 50, 2.0, 3.3, 21, '1단', 'PA66', 'PA66', 'POM + 실리콘 댐퍼', true, 5, '#D99B82', '#C7826B', '#F0C4B3'),
  ('sw-outemu-silent-lime-v3', 'outemu-silent-lime-v3', '오테뮤 저소음 라임 V3', 'Outemu Silent Lime V3', 'Outemu', 'silent_tactile', 35, 45, 1.8, 3.3, 21, '1단', 'PA66', 'PA66', 'POM + 실리콘 댐퍼', true, 5, '#9AB87A', '#7A9A5B', '#C7E0AE'),
  ('sw-kailh-box-jade', 'kailh-box-jade', '카일 박스 백축 (Box Jade)', 'Kailh Box Jade', 'Kailh', 'clicky', 50, null, 1.8, 3.6, 15, '1단', 'PC', 'Nylon', 'POM (박스 구조)', false, 3, '#C5D1CC', '#D9DBD8', '#6B9080'),
  ('sw-wooting-lekker-l45-v2', 'wooting-lekker-l45-v2', '우팅 렉커 L45 V2', 'Wooting Lekker L45 V2', 'Wooting', 'magnetic', 30, 45, 0.1, 4.0, 19.5, '1단', 'PC', 'Nylon', 'POM', true, 3, '#7A9E9F', '#3A4E4F', '#A8C6C7'),
  ('sw-gateron-magnetic-jade', 'gateron-magnetic-jade', '게이트론 매그네틱 제이드', 'Gateron Magnetic Jade', 'Gateron', 'magnetic', 30, 50, 0.1, 3.5, 20, '1단', 'PC', 'Nylon (PA66)', 'POM (막힌 하단)', true, 3, '#88B39E', '#4E7363', '#DCE8E1')
on conflict (id) do nothing;

insert into public.mice (
  id, slug, name, name_en, brand, max_polling_hz, connection, shape,
  length_mm, width_mm, height_mm, weight_grams,
  sensor, switch_type, switch_model, color_accent_hex
) values
  ('ms-razer-viper-v3-pro', 'razer-viper-v3-pro', 'Razer 바이퍼 V3 Pro', 'Razer Viper V3 Pro', 'Razer', 8000, 'wireless_wired', 'symmetrical', 127.1, 63.9, 39.9, 54, 'Focus Pro 35K Gen-2', 'optical', 'Razer 3세대', '#6B9080'),
  ('ms-logitech-gpx-superlight-2', 'logitech-gpx-superlight-2', 'Logitech 지슈라 2 (GPX 2)', 'G PRO X SUPERLIGHT 2', 'Logitech', 8000, 'wireless_wired', 'symmetrical', 125.0, 63.5, 40.0, 60, 'HERO 2', 'optical', 'LIGHTFORCE', '#8F9691'),
  ('ms-razer-deathadder-v3-pro', 'razer-deathadder-v3-pro', 'Razer 데스에더 V3 Pro', 'Razer DeathAdder V3 Pro', 'Razer', 8000, 'wireless_wired', 'ergonomic', 128.0, 68.0, 44.0, 63, 'Focus Pro 30K', 'optical', 'Razer 3세대', '#6B9080'),
  ('ms-wlmouse-beast-x-max', 'wlmouse-beast-x-max', 'WLMouse 비스트 X Max', 'WLMouse Beast X Max', 'WLMouse', 8000, 'wireless_wired', 'symmetrical', 126.0, 65.0, 39.0, 42, 'PAW3950 HS', 'optical', 'Omron', '#D4A373'),
  ('ms-lamzu-maya-x-8k', 'lamzu-maya-x-8k', 'Lamzu 마야 X 8K', 'Lamzu Maya X 8K', 'Lamzu', 8000, 'wireless_wired', 'symmetrical', 124.0, 64.0, 40.0, 47, 'PAW3950', 'optical', 'Omron', '#6B9080'),
  ('ms-atk-f1-ultimate', 'atk-f1-ultimate', 'ATK F1 얼티밋', 'ATK Blazing Sky F1 Ultimate', 'ATK', 8000, 'wireless_wired', 'symmetrical', 118.2, 62.4, 38.8, 38, 'PAW3950 Ultra', 'optical', 'Omron', '#D4A373'),
  ('ms-endgame-gear-op1-8k', 'endgame-gear-op1-8k', 'Endgame Gear OP1 8k', 'Endgame Gear OP1 8k', 'Endgame Gear', 8000, 'wired', 'symmetrical', 118.2, 60.5, 37.2, 50.5, 'PAW3395', 'mechanical', 'Kailh GX', '#8F9691'),
  ('ms-pulsar-x2v2-mini', 'pulsar-x2v2-mini', 'Pulsar X2V2 미니', 'Pulsar X2V2 Mini', 'Pulsar', 4000, 'wireless_wired', 'symmetrical', 115.6, 60.6, 36.7, 51, 'PAW3395', 'optical', 'Raesha', '#6B9080'),
  ('ms-vaxee-xe-s-wireless', 'vaxee-xe-s-wireless', 'VAXEE XE-S Wireless (4K)', 'VAXEE XE-S Wireless 4K', 'VAXEE', 4000, 'wireless_wired', 'symmetrical', 119.0, 60.5, 37.0, 60, 'PAW3395', 'mechanical', 'Huano 핑크닷', '#8F9691'),
  ('ms-zowie-u2', 'zowie-u2', 'ZOWIE U2 무선', 'BenQ ZOWIE U2 Wireless', 'ZOWIE', 1000, 'wireless_wired', 'symmetrical', 123.0, 61.5, 38.0, 60, 'PAW3395', 'mechanical', 'Huano 블루쉘 핑크닷', '#8F9691')
on conflict (id) do nothing;
