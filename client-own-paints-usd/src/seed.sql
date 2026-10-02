-- =========================================
-- CATALOGUE SEED — Spectrum Coatings
-- Run this AFTER src/schema.sql and src/sql/functions.sql.
-- =========================================
--
-- This is the SQL twin of src/seed.js: the same 18 colours, 10 products and
-- 143 product_variants, with deterministic UUIDs so re-running it updates the
-- catalogue in place instead of duplicating it (the local engine seeds the same
-- rows into the browser via the service role; a real project is seeded here
-- because the browser only holds the anon key and RLS refuses catalogue writes).
--
-- Generated from src/seed.js — edit that file and regenerate rather than
-- hand-editing ids here.

-- ---------------------------------------------------------------- colours
insert into public.colors (id, name, hex_code, category, description, finish_types) values
  ('a2e31a02-8744-46d8-83e0-7c5676337b04', 'Ivory White', '#F5F1E8', 'Neutrals', 'Our brightest off-white. Warm enough for north-facing rooms, crisp enough for trim.', array['Matte', 'Eggshell', 'Satin', 'Gloss']::text[]),
  ('a9473838-934a-41f0-97a6-5780eac171cc', 'Warm Alabaster', '#EFE7D8', 'Neutrals', 'Soft, chalky and forgiving — the colour we use most for whole-house repaints.', array['Matte', 'Eggshell', 'Satin', 'Gloss']::text[]),
  ('a4251b8c-40e9-497a-bb72-37f0e926bf56', 'Pure Linen', '#E8E1D5', 'Neutrals', 'A gentle greige that holds its own against oak floors and stone worktops.', array['Matte', 'Eggshell', 'Satin']::text[]),
  ('9f29c119-63f1-4f15-b5d7-fdf1ad211921', 'Coastal Sage', '#A8B49B', 'Greens', 'Sea-worn green with a grey backbone. Calm in bedrooms, charming on front doors.', array['Matte', 'Eggshell', 'Satin', 'Gloss']::text[]),
  ('26e95503-160f-4c77-ab74-6c8363e0ef1b', 'Deep Forest', '#2E4B3C', 'Greens', 'A proper heritage green for studies, cabinetry and window frames.', array['Matte', 'Eggshell', 'Satin']::text[]),
  ('334645bd-d1f7-4739-9d62-207559cd9335', 'Sage Mist', '#C9D3C2', 'Greens', 'Barely-there sage for ceilings and small rooms that need to breathe.', array['Matte', 'Eggshell', 'Silk']::text[]),
  ('20dc424e-f4c6-4410-8715-efd235440a14', 'Olive Grove', '#6B7A57', 'Greens', 'Earthy olive with yellow in its heart — beautiful behind timber shelving.', array['Matte', 'Eggshell', 'Satin']::text[]),
  ('5fc4e1c2-b748-4af8-a3af-f4a65c3dc144', 'Midnight Navy', '#1F2A44', 'Blues', 'Deep, saturated and quietly luxurious. Our most requested accent colour.', array['Matte', 'Eggshell', 'Satin', 'Gloss']::text[]),
  ('4fff1581-667f-427d-a2fc-35e183ad6af9', 'Harbour Blue', '#4A6E8A', 'Blues', 'The blue of a grey morning on the water. Works indoors and on render.', array['Matte', 'Eggshell', 'Satin']::text[]),
  ('0e1c4e92-8d2c-4ef0-9680-efb6de2b8f14', 'Sky Wash', '#A9C6D9', 'Blues', 'Pale, airy and light-bouncing — ideal for small bathrooms and hallways.', array['Matte', 'Eggshell', 'Silk']::text[]),
  ('b240e344-c47b-46b8-8230-1a6c07f8b574', 'Terracotta Clay', '#C56A4B', 'Warms', 'Sun-baked clay that flatters brick, timber and south-facing light.', array['Matte', 'Eggshell', 'Textured']::text[]),
  ('8dcdc32f-c61a-402b-9e6c-9a471303f6cf', 'Burnt Sienna', '#9C4A2F', 'Warms', 'A richer, duskier terracotta for boundary walls, plinths and masonry.', array['Matte', 'Textured']::text[]),
  ('7d1c088a-82a0-439a-a8d6-3eb2c423cba6', 'Dusty Rose', '#C68C8C', 'Warms', 'Muted, grown-up pink — lovely in a child''s room without shouting.', array['Matte', 'Eggshell', 'Silk']::text[]),
  ('2ac508cc-c9cf-4e52-a5d0-c2584f70524e', 'Heritage Ochre', '#D9A441', 'Warms', 'Golden ochre drawn from Victorian paint charts. Brilliant on panelled doors.', array['Matte', 'Eggshell', 'Satin']::text[]),
  ('349607a4-97bb-4770-9b3d-11ac31832114', 'Amber Glow', '#E0A96D', 'Warms', 'A soft apricot that warms cold northern light without going orange.', array['Matte', 'Eggshell', 'Silk']::text[]),
  ('07e45028-cd9e-4cfa-8540-a8d47f04350e', 'Charcoal Slate', '#3B3F42', 'Greys', 'Near-black with a whisper of blue. Our favourite for windows and railings.', array['Matte', 'Eggshell', 'Satin', 'Gloss']::text[]),
  ('fbbe2c5f-9431-4317-a3c2-30975de07a03', 'Dove Grey', '#B9BCB8', 'Greys', 'Neutral cool grey that pairs with absolutely everything.', array['Matte', 'Eggshell', 'Satin', 'Gloss']::text[]),
  ('40442b0c-7fbb-4904-8d58-49648318a220', 'Pewter Mist', '#8A8F8C', 'Greys', 'Mid-tone green-grey for fences, garages and utility rooms.', array['Matte', 'Eggshell', 'Textured']::text[])
on conflict (id) do update set
  name = excluded.name, hex_code = excluded.hex_code, category = excluded.category,
  description = excluded.description, finish_types = excluded.finish_types;

-- --------------------------------------------------------------- products
insert into public.products (id, title, base_price, paint_type, size_options, description) values
  ('afeb9cb6-88c4-4b30-b148-0e8a126e4a54', 'Signature Interior Emulsion', 42, 'Interior', array['1L', '2.5L', '5L', '10L']::text[], 'Our flagship wall paint: a dense, easy-brushing emulsion with superb opacity and a flat, velvety finish. Mixed to order in any of our interior colours.'),
  ('cc5b74d3-a85e-47b5-8a4c-ca77ca4779a1', 'Ultra-Matte Ceiling Paint', 32.5, 'Interior', array['2.5L', '5L', '10L']::text[], 'A super-flat ceiling paint that kills glare and hides roller marks. Thick enough to bridge hairline cracks in old plaster.'),
  ('96d0f8a2-8b6f-4298-918c-9dd669249dcc', 'Washable Silk Interior', 49, 'Interior', array['1L', '2.5L', '5L']::text[], 'A hard-wearing low-sheen finish that shrugs off crayon, coffee and muddy paws. The one we recommend for hallways, kitchens and kids'' rooms.'),
  ('14808cbf-b5bb-420d-ab2f-1b9b9d9a3289', 'Multi-Surface Primer & Undercoat', 36, 'Interior', array['1L', '2.5L', '5L']::text[], 'Bonds to bare plaster, new timber and previously glossed surfaces. One coat primes, seals and gives your topcoat something to grip.'),
  ('752c4424-36de-4506-8dde-fb08050828f2', 'Weathershield Exterior Satin', 54, 'Exterior', array['1L', '2.5L', '5L']::text[], 'Flexible, rain-resistant masonry and render paint with UV-stable pigments and a 15-year weathering warranty.'),
  ('70c94f02-c4a7-4d4c-ada5-a15e3b42b878', 'Exterior Gloss Wood & Metal', 51, 'Exterior', array['1L', '2.5L', '5L']::text[], 'A traditional high-gloss for doors, window frames, gutters and railings. Non-yellowing, quick-drying and glass-hard once cured.'),
  ('fa0ebfce-b12f-4846-a72f-f036fa7895ea', 'Fence & Shed Stain', 38.5, 'Exterior', array['5L', '10L']::text[], 'A penetrating water-based stain that colours and protects rough sawn timber in two coats, without hiding the grain.'),
  ('e66a49a0-c820-438e-9cc3-420cf130f41a', 'Masonry Shield Smooth', 58, 'Masonry', array['5L', '10L']::text[], 'A tough, breathable coating for brick, block and render. Smooth finish, excellent dirt-shedding and a properly sealed surface.'),
  ('67007629-9d00-4369-8e37-9019da363a7d', 'Masonry Shield Textured', 62, 'Masonry', array['5L', '10L']::text[], 'Roller-applied texture that fills small imperfections and hides patch repairs on older walls. Ideal for pebbledash and tired render.'),
  ('89e325a0-aa44-4620-abb2-e1201c1614d4', 'Damp-Block Masonry Primer', 55, 'Masonry', array['5L', '10L']::text[], 'Alkali-resistant primer that locks damp staining out of interior masonry and keeps salts from blooming through your topcoat.')
on conflict (id) do update set
  title = excluded.title, base_price = excluded.base_price, paint_type = excluded.paint_type,
  size_options = excluded.size_options, description = excluded.description, updated_at = now();

-- ---------------------------------------------------- product_variants
-- products x colours, restricted by each colour's paint-system usage.
-- stock_status is derived from the same deterministic hash src/seed.js uses,
-- so a browser-local shop and a seeded project agree on what is in stock.
insert into public.product_variants (id, product_id, color_id, stock_status, image_url) values
  ('597886da-fba7-41aa-8750-6abaa9c433de', 'afeb9cb6-88c4-4b30-b148-0e8a126e4a54', 'a2e31a02-8744-46d8-83e0-7c5676337b04', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('96e88ac0-93f3-4ada-9268-3514cdf841ae', 'afeb9cb6-88c4-4b30-b148-0e8a126e4a54', 'a9473838-934a-41f0-97a6-5780eac171cc', 'Low Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('99af7054-4da8-4a64-97e1-b97c18014fa8', 'afeb9cb6-88c4-4b30-b148-0e8a126e4a54', 'a4251b8c-40e9-497a-bb72-37f0e926bf56', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('f59d2fe1-ba44-4c97-822f-fab5d21c0c6b', 'afeb9cb6-88c4-4b30-b148-0e8a126e4a54', '9f29c119-63f1-4f15-b5d7-fdf1ad211921', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('165ad4fb-251e-4db1-8774-f1f702e5143d', 'afeb9cb6-88c4-4b30-b148-0e8a126e4a54', '26e95503-160f-4c77-ab74-6c8363e0ef1b', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('07a8f505-4cc4-412f-acb2-dbb1ba3006c3', 'afeb9cb6-88c4-4b30-b148-0e8a126e4a54', '334645bd-d1f7-4739-9d62-207559cd9335', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('9f6dc6d6-ba41-4f6a-a64a-635eaa6bea06', 'afeb9cb6-88c4-4b30-b148-0e8a126e4a54', '20dc424e-f4c6-4410-8715-efd235440a14', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('471f245a-9b32-4082-8915-36ea88dbd566', 'afeb9cb6-88c4-4b30-b148-0e8a126e4a54', '5fc4e1c2-b748-4af8-a3af-f4a65c3dc144', 'Low Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('8aad9bb9-a6bd-4257-a261-38655f49745b', 'afeb9cb6-88c4-4b30-b148-0e8a126e4a54', '4fff1581-667f-427d-a2fc-35e183ad6af9', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('a81fcfca-7e54-43e6-a8d9-f9da7e77fb32', 'afeb9cb6-88c4-4b30-b148-0e8a126e4a54', '0e1c4e92-8d2c-4ef0-9680-efb6de2b8f14', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('ad25b07c-1560-4496-9e47-3fe8c93df96a', 'afeb9cb6-88c4-4b30-b148-0e8a126e4a54', 'b240e344-c47b-46b8-8230-1a6c07f8b574', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('31cfc772-8bd7-4bc8-a5c4-cd0643c30c6c', 'afeb9cb6-88c4-4b30-b148-0e8a126e4a54', '7d1c088a-82a0-439a-a8d6-3eb2c423cba6', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('c4b28d94-f1e6-47c4-8d6a-39c48e329278', 'afeb9cb6-88c4-4b30-b148-0e8a126e4a54', '2ac508cc-c9cf-4e52-a5d0-c2584f70524e', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('37ae4b1c-c981-4f7a-8c81-e4c8ce3ee946', 'afeb9cb6-88c4-4b30-b148-0e8a126e4a54', '349607a4-97bb-4770-9b3d-11ac31832114', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('70a824b0-a614-4684-84eb-ef58ccb6b930', 'afeb9cb6-88c4-4b30-b148-0e8a126e4a54', '07e45028-cd9e-4cfa-8540-a8d47f04350e', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('478892e7-02aa-41b1-88e0-1b63e023d765', 'afeb9cb6-88c4-4b30-b148-0e8a126e4a54', 'fbbe2c5f-9431-4317-a3c2-30975de07a03', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('26ecd574-7852-4132-8aaf-e68002268036', 'afeb9cb6-88c4-4b30-b148-0e8a126e4a54', '40442b0c-7fbb-4904-8d58-49648318a220', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('232fd9bf-7d22-493f-9448-457f5a4f427b', 'cc5b74d3-a85e-47b5-8a4c-ca77ca4779a1', 'a2e31a02-8744-46d8-83e0-7c5676337b04', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('c958de35-b5ad-4261-a78c-9af530038335', 'cc5b74d3-a85e-47b5-8a4c-ca77ca4779a1', 'a9473838-934a-41f0-97a6-5780eac171cc', 'Low Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('11415981-a539-463b-963d-9a8d34f9527f', 'cc5b74d3-a85e-47b5-8a4c-ca77ca4779a1', 'a4251b8c-40e9-497a-bb72-37f0e926bf56', 'Low Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('021f3f54-7672-4200-812f-9d4c4dfd9994', 'cc5b74d3-a85e-47b5-8a4c-ca77ca4779a1', '9f29c119-63f1-4f15-b5d7-fdf1ad211921', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('2887a85e-dfc9-4814-bf0c-6a029c5fa5c8', 'cc5b74d3-a85e-47b5-8a4c-ca77ca4779a1', '26e95503-160f-4c77-ab74-6c8363e0ef1b', 'Low Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('bb7c2b20-6f6b-4fce-af82-8e241d19d77a', 'cc5b74d3-a85e-47b5-8a4c-ca77ca4779a1', '334645bd-d1f7-4739-9d62-207559cd9335', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('11351cf3-f18d-4deb-b8cc-22eb5e4dbe4f', 'cc5b74d3-a85e-47b5-8a4c-ca77ca4779a1', '20dc424e-f4c6-4410-8715-efd235440a14', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('e7a7ebff-c3d3-49bf-8de8-13bf9ad3a60b', 'cc5b74d3-a85e-47b5-8a4c-ca77ca4779a1', '5fc4e1c2-b748-4af8-a3af-f4a65c3dc144', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('5591c50c-fd86-4aac-af71-00e4c4b38010', 'cc5b74d3-a85e-47b5-8a4c-ca77ca4779a1', '4fff1581-667f-427d-a2fc-35e183ad6af9', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('9543919f-9f08-45bd-b081-c8db65d0a019', 'cc5b74d3-a85e-47b5-8a4c-ca77ca4779a1', '0e1c4e92-8d2c-4ef0-9680-efb6de2b8f14', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('7fbf3839-89b4-4d07-8d64-43c5e446af63', 'cc5b74d3-a85e-47b5-8a4c-ca77ca4779a1', 'b240e344-c47b-46b8-8230-1a6c07f8b574', 'Low Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('c5dc6447-4d5a-4ae3-bb4d-46c7b12e9387', 'cc5b74d3-a85e-47b5-8a4c-ca77ca4779a1', '7d1c088a-82a0-439a-a8d6-3eb2c423cba6', 'Low Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('c87f1aa1-577d-421f-9e2b-cefd08a23623', 'cc5b74d3-a85e-47b5-8a4c-ca77ca4779a1', '2ac508cc-c9cf-4e52-a5d0-c2584f70524e', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('f7586cc9-0393-4381-8796-7fc9e57d42cd', 'cc5b74d3-a85e-47b5-8a4c-ca77ca4779a1', '349607a4-97bb-4770-9b3d-11ac31832114', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('03e87ec5-ec0b-4b8f-9628-04c9ce49dd3b', 'cc5b74d3-a85e-47b5-8a4c-ca77ca4779a1', '07e45028-cd9e-4cfa-8540-a8d47f04350e', 'Low Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('3c461562-e5a1-4460-b99d-e5a6c16c594c', 'cc5b74d3-a85e-47b5-8a4c-ca77ca4779a1', 'fbbe2c5f-9431-4317-a3c2-30975de07a03', 'Low Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('0edebb11-565e-45df-95e6-a4f5807fa80b', 'cc5b74d3-a85e-47b5-8a4c-ca77ca4779a1', '40442b0c-7fbb-4904-8d58-49648318a220', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('f8d696ce-92fb-459e-8b0c-a66617ca76d2', '96d0f8a2-8b6f-4298-918c-9dd669249dcc', 'a2e31a02-8744-46d8-83e0-7c5676337b04', 'Low Stock', 'https://user.uploads.dev/file/aa49397b7172f2e045f70f8b018a5d99.jpg'),
  ('eb484d34-909b-4296-83f7-6050f440e73a', '96d0f8a2-8b6f-4298-918c-9dd669249dcc', 'a9473838-934a-41f0-97a6-5780eac171cc', 'In Stock', 'https://user.uploads.dev/file/aa49397b7172f2e045f70f8b018a5d99.jpg'),
  ('7f186d00-072c-4018-a0ac-8600d9373dfc', '96d0f8a2-8b6f-4298-918c-9dd669249dcc', 'a4251b8c-40e9-497a-bb72-37f0e926bf56', 'In Stock', 'https://user.uploads.dev/file/aa49397b7172f2e045f70f8b018a5d99.jpg'),
  ('74dafc95-0bdf-4ca3-8c11-f8010e709a47', '96d0f8a2-8b6f-4298-918c-9dd669249dcc', '9f29c119-63f1-4f15-b5d7-fdf1ad211921', 'In Stock', 'https://user.uploads.dev/file/aa49397b7172f2e045f70f8b018a5d99.jpg'),
  ('68a17c4f-dbc9-4755-996a-99731ed694c1', '96d0f8a2-8b6f-4298-918c-9dd669249dcc', '26e95503-160f-4c77-ab74-6c8363e0ef1b', 'In Stock', 'https://user.uploads.dev/file/aa49397b7172f2e045f70f8b018a5d99.jpg'),
  ('66ad7471-a2b6-4a8b-a867-1d85f9db4bff', '96d0f8a2-8b6f-4298-918c-9dd669249dcc', '334645bd-d1f7-4739-9d62-207559cd9335', 'Low Stock', 'https://user.uploads.dev/file/aa49397b7172f2e045f70f8b018a5d99.jpg'),
  ('4396fd02-d0fe-49a6-b921-b7e279d719c2', '96d0f8a2-8b6f-4298-918c-9dd669249dcc', '20dc424e-f4c6-4410-8715-efd235440a14', 'In Stock', 'https://user.uploads.dev/file/aa49397b7172f2e045f70f8b018a5d99.jpg'),
  ('be3fd48e-9c30-42a6-90a4-2d36f79c7fca', '96d0f8a2-8b6f-4298-918c-9dd669249dcc', '5fc4e1c2-b748-4af8-a3af-f4a65c3dc144', 'In Stock', 'https://user.uploads.dev/file/aa49397b7172f2e045f70f8b018a5d99.jpg'),
  ('fca6138d-3c9f-4233-8bec-ab11ec7362d7', '96d0f8a2-8b6f-4298-918c-9dd669249dcc', '4fff1581-667f-427d-a2fc-35e183ad6af9', 'Out of Stock', 'https://user.uploads.dev/file/aa49397b7172f2e045f70f8b018a5d99.jpg'),
  ('022bb41e-7f45-4182-ac54-18a6acea94ae', '96d0f8a2-8b6f-4298-918c-9dd669249dcc', '0e1c4e92-8d2c-4ef0-9680-efb6de2b8f14', 'In Stock', 'https://user.uploads.dev/file/aa49397b7172f2e045f70f8b018a5d99.jpg'),
  ('ff07b808-a7f8-4f02-afde-7c9cd7ae0d06', '96d0f8a2-8b6f-4298-918c-9dd669249dcc', 'b240e344-c47b-46b8-8230-1a6c07f8b574', 'In Stock', 'https://user.uploads.dev/file/aa49397b7172f2e045f70f8b018a5d99.jpg'),
  ('9932ff06-aa6a-40d4-802a-3e62e9334388', '96d0f8a2-8b6f-4298-918c-9dd669249dcc', '7d1c088a-82a0-439a-a8d6-3eb2c423cba6', 'In Stock', 'https://user.uploads.dev/file/aa49397b7172f2e045f70f8b018a5d99.jpg'),
  ('c61c09c0-4024-4278-9d9c-c8684873d90c', '96d0f8a2-8b6f-4298-918c-9dd669249dcc', '2ac508cc-c9cf-4e52-a5d0-c2584f70524e', 'Low Stock', 'https://user.uploads.dev/file/aa49397b7172f2e045f70f8b018a5d99.jpg'),
  ('05eaea28-d0bc-480e-b1c9-d61c43b409aa', '96d0f8a2-8b6f-4298-918c-9dd669249dcc', '349607a4-97bb-4770-9b3d-11ac31832114', 'Out of Stock', 'https://user.uploads.dev/file/aa49397b7172f2e045f70f8b018a5d99.jpg'),
  ('ef022ca4-ee5e-4600-aacc-91240d1e191c', '96d0f8a2-8b6f-4298-918c-9dd669249dcc', '07e45028-cd9e-4cfa-8540-a8d47f04350e', 'In Stock', 'https://user.uploads.dev/file/aa49397b7172f2e045f70f8b018a5d99.jpg'),
  ('a905c413-78d7-48bd-a6c0-f2e7ada34d51', '96d0f8a2-8b6f-4298-918c-9dd669249dcc', 'fbbe2c5f-9431-4317-a3c2-30975de07a03', 'In Stock', 'https://user.uploads.dev/file/aa49397b7172f2e045f70f8b018a5d99.jpg'),
  ('56885a40-a1a5-4c5e-bcf5-6114675a2542', '96d0f8a2-8b6f-4298-918c-9dd669249dcc', '40442b0c-7fbb-4904-8d58-49648318a220', 'In Stock', 'https://user.uploads.dev/file/aa49397b7172f2e045f70f8b018a5d99.jpg'),
  ('335fa153-caff-447b-b78e-a7c3487e36b7', '14808cbf-b5bb-420d-ab2f-1b9b9d9a3289', 'a2e31a02-8744-46d8-83e0-7c5676337b04', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('88ce3e59-cecf-4b15-8ea2-06d95ac28bf9', '14808cbf-b5bb-420d-ab2f-1b9b9d9a3289', 'a9473838-934a-41f0-97a6-5780eac171cc', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('0253d62d-13bf-48f7-b157-1649873b345b', '14808cbf-b5bb-420d-ab2f-1b9b9d9a3289', 'a4251b8c-40e9-497a-bb72-37f0e926bf56', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('87da3878-5dc9-4254-8e2c-b8c0ff924418', '14808cbf-b5bb-420d-ab2f-1b9b9d9a3289', '9f29c119-63f1-4f15-b5d7-fdf1ad211921', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('da29f0f2-739d-48c0-9cab-4f462a4bd074', '14808cbf-b5bb-420d-ab2f-1b9b9d9a3289', '26e95503-160f-4c77-ab74-6c8363e0ef1b', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('99a516cc-dbb0-4032-b72f-22c00f0920be', '14808cbf-b5bb-420d-ab2f-1b9b9d9a3289', '334645bd-d1f7-4739-9d62-207559cd9335', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('7fdb911f-eae3-4bdf-882a-df876d379f83', '14808cbf-b5bb-420d-ab2f-1b9b9d9a3289', '20dc424e-f4c6-4410-8715-efd235440a14', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('2de59793-8388-4c9b-aa9a-9433fb790187', '14808cbf-b5bb-420d-ab2f-1b9b9d9a3289', '5fc4e1c2-b748-4af8-a3af-f4a65c3dc144', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('d67fe920-eb9d-47a0-8949-a398e18d0c44', '14808cbf-b5bb-420d-ab2f-1b9b9d9a3289', '4fff1581-667f-427d-a2fc-35e183ad6af9', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('632bb533-441f-4c01-8aa7-e22f469fb19d', '14808cbf-b5bb-420d-ab2f-1b9b9d9a3289', '0e1c4e92-8d2c-4ef0-9680-efb6de2b8f14', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('8c794255-eda7-4cdb-872f-f9811105d0c7', '14808cbf-b5bb-420d-ab2f-1b9b9d9a3289', 'b240e344-c47b-46b8-8230-1a6c07f8b574', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('e1c75e6b-6db2-4c47-b42a-070b456128fb', '14808cbf-b5bb-420d-ab2f-1b9b9d9a3289', '7d1c088a-82a0-439a-a8d6-3eb2c423cba6', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('808c28cd-945e-4f0b-a0ed-f7a9dbe0516f', '14808cbf-b5bb-420d-ab2f-1b9b9d9a3289', '2ac508cc-c9cf-4e52-a5d0-c2584f70524e', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('7e14ac65-4cfb-418d-901d-4685de252249', '14808cbf-b5bb-420d-ab2f-1b9b9d9a3289', '349607a4-97bb-4770-9b3d-11ac31832114', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('6b469069-01d9-4453-953f-634d4e8e4fcf', '14808cbf-b5bb-420d-ab2f-1b9b9d9a3289', '07e45028-cd9e-4cfa-8540-a8d47f04350e', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('afb3160e-98c9-4334-befe-b252fecd5ec0', '14808cbf-b5bb-420d-ab2f-1b9b9d9a3289', 'fbbe2c5f-9431-4317-a3c2-30975de07a03', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('e12f6bbd-eb7d-4b73-8259-2e41852ec1ff', '14808cbf-b5bb-420d-ab2f-1b9b9d9a3289', '40442b0c-7fbb-4904-8d58-49648318a220', 'In Stock', 'https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg'),
  ('7166ec48-3d40-4f58-9faf-35f81a540414', '752c4424-36de-4506-8dde-fb08050828f2', 'a2e31a02-8744-46d8-83e0-7c5676337b04', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('854ac992-ac9f-4d70-bb6f-9f2eea7ff5fc', '752c4424-36de-4506-8dde-fb08050828f2', 'a9473838-934a-41f0-97a6-5780eac171cc', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('a4b2ff26-b53d-44fa-80a8-c8e61d4f0346', '752c4424-36de-4506-8dde-fb08050828f2', 'a4251b8c-40e9-497a-bb72-37f0e926bf56', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('dcbb05f3-7976-4295-94c1-b22f917a3a11', '752c4424-36de-4506-8dde-fb08050828f2', '9f29c119-63f1-4f15-b5d7-fdf1ad211921', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('5144e0c9-cc0c-44f7-9823-b9b5f5afdf0b', '752c4424-36de-4506-8dde-fb08050828f2', '26e95503-160f-4c77-ab74-6c8363e0ef1b', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('f4a89944-aac3-4c90-9b20-e5fc104363e4', '752c4424-36de-4506-8dde-fb08050828f2', '20dc424e-f4c6-4410-8715-efd235440a14', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('f6816fc8-2007-4b78-98e2-32d8d8cf9d54', '752c4424-36de-4506-8dde-fb08050828f2', '5fc4e1c2-b748-4af8-a3af-f4a65c3dc144', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('02f477ab-7c04-45fd-8c67-175f09e2f189', '752c4424-36de-4506-8dde-fb08050828f2', '4fff1581-667f-427d-a2fc-35e183ad6af9', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('0c1e33ce-1320-4f38-b70c-e45a98d93fe4', '752c4424-36de-4506-8dde-fb08050828f2', 'b240e344-c47b-46b8-8230-1a6c07f8b574', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('1f359a05-db9f-43ab-98ca-0469ef1a9c5f', '752c4424-36de-4506-8dde-fb08050828f2', '8dcdc32f-c61a-402b-9e6c-9a471303f6cf', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('ed79baa6-e325-49d2-87ff-f95e71e303fe', '752c4424-36de-4506-8dde-fb08050828f2', '2ac508cc-c9cf-4e52-a5d0-c2584f70524e', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('f420eb82-e6f4-487a-9dbc-e3d2a47c3cfe', '752c4424-36de-4506-8dde-fb08050828f2', '07e45028-cd9e-4cfa-8540-a8d47f04350e', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('7739bf55-ba28-4397-b358-6f8182c290d3', '752c4424-36de-4506-8dde-fb08050828f2', 'fbbe2c5f-9431-4317-a3c2-30975de07a03', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('9449aec6-35b8-4184-82a1-79e2a8ce3e90', '752c4424-36de-4506-8dde-fb08050828f2', '40442b0c-7fbb-4904-8d58-49648318a220', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('56b1e9ee-b02a-466e-9614-a76e4b3c3e8a', '70c94f02-c4a7-4d4c-ada5-a15e3b42b878', 'a2e31a02-8744-46d8-83e0-7c5676337b04', 'Out of Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('29d21e94-e74f-4606-a191-d0a8c1019972', '70c94f02-c4a7-4d4c-ada5-a15e3b42b878', 'a9473838-934a-41f0-97a6-5780eac171cc', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('31bfb8e0-c5d4-4108-a51b-2098637d78b4', '70c94f02-c4a7-4d4c-ada5-a15e3b42b878', 'a4251b8c-40e9-497a-bb72-37f0e926bf56', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('eda89375-5f78-4d53-8cc2-31b93020715f', '70c94f02-c4a7-4d4c-ada5-a15e3b42b878', '9f29c119-63f1-4f15-b5d7-fdf1ad211921', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('b4e2bbef-8190-4d45-90b7-7e7ba7489419', '70c94f02-c4a7-4d4c-ada5-a15e3b42b878', '26e95503-160f-4c77-ab74-6c8363e0ef1b', 'Out of Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('053bd3a2-7499-4436-b690-a15a20238aca', '70c94f02-c4a7-4d4c-ada5-a15e3b42b878', '20dc424e-f4c6-4410-8715-efd235440a14', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('18a25e2e-318d-4d76-b521-1d3e04437722', '70c94f02-c4a7-4d4c-ada5-a15e3b42b878', '5fc4e1c2-b748-4af8-a3af-f4a65c3dc144', 'Low Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('d45c51ed-0233-4383-9d3f-2eb963696b5f', '70c94f02-c4a7-4d4c-ada5-a15e3b42b878', '4fff1581-667f-427d-a2fc-35e183ad6af9', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('680a0aa8-7008-4232-ab34-b9e48ba4b11e', '70c94f02-c4a7-4d4c-ada5-a15e3b42b878', 'b240e344-c47b-46b8-8230-1a6c07f8b574', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('1a71df83-55fd-43fd-bfaa-f22f8c302eb1', '70c94f02-c4a7-4d4c-ada5-a15e3b42b878', '8dcdc32f-c61a-402b-9e6c-9a471303f6cf', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('d5286420-fd4f-4b28-b0ce-b44038121544', '70c94f02-c4a7-4d4c-ada5-a15e3b42b878', '2ac508cc-c9cf-4e52-a5d0-c2584f70524e', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('746f4704-17c9-4970-9098-bb1c0f9de814', '70c94f02-c4a7-4d4c-ada5-a15e3b42b878', '07e45028-cd9e-4cfa-8540-a8d47f04350e', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('b99a6fb3-664a-460d-892b-105f85b93959', '70c94f02-c4a7-4d4c-ada5-a15e3b42b878', 'fbbe2c5f-9431-4317-a3c2-30975de07a03', 'Low Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('bedd0b60-f5ed-4c0e-9988-ef4c6885e44a', '70c94f02-c4a7-4d4c-ada5-a15e3b42b878', '40442b0c-7fbb-4904-8d58-49648318a220', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('52990e62-9fbd-4fdc-920d-ab360fad7d50', 'fa0ebfce-b12f-4846-a72f-f036fa7895ea', 'a2e31a02-8744-46d8-83e0-7c5676337b04', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('93e8a758-2f52-4e1c-9e27-f7206a680c90', 'fa0ebfce-b12f-4846-a72f-f036fa7895ea', 'a9473838-934a-41f0-97a6-5780eac171cc', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('0ce5232c-bffd-4a2e-b999-5b90ecc385f2', 'fa0ebfce-b12f-4846-a72f-f036fa7895ea', 'a4251b8c-40e9-497a-bb72-37f0e926bf56', 'Out of Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('b07c8bb9-3844-4c01-9051-791197140165', 'fa0ebfce-b12f-4846-a72f-f036fa7895ea', '9f29c119-63f1-4f15-b5d7-fdf1ad211921', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('b8d77de3-1c4a-4a2b-ad93-1a6388c864d7', 'fa0ebfce-b12f-4846-a72f-f036fa7895ea', '26e95503-160f-4c77-ab74-6c8363e0ef1b', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('35b2b72e-775f-4e7c-b495-8f3208320d38', 'fa0ebfce-b12f-4846-a72f-f036fa7895ea', '20dc424e-f4c6-4410-8715-efd235440a14', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('8dcd12a2-5adf-48bc-875a-4e0653876a30', 'fa0ebfce-b12f-4846-a72f-f036fa7895ea', '5fc4e1c2-b748-4af8-a3af-f4a65c3dc144', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('7dd6e7a1-d8d0-4689-a1dd-c4017fdf52bd', 'fa0ebfce-b12f-4846-a72f-f036fa7895ea', '4fff1581-667f-427d-a2fc-35e183ad6af9', 'Low Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('e1a1ac24-8c71-4ae4-8cd1-23cc4f452078', 'fa0ebfce-b12f-4846-a72f-f036fa7895ea', 'b240e344-c47b-46b8-8230-1a6c07f8b574', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('ec4ed74f-e7ee-4f3f-9c30-99e7f6a8048b', 'fa0ebfce-b12f-4846-a72f-f036fa7895ea', '8dcdc32f-c61a-402b-9e6c-9a471303f6cf', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('c9144fec-8db0-40f6-b803-d2f8e3477ada', 'fa0ebfce-b12f-4846-a72f-f036fa7895ea', '2ac508cc-c9cf-4e52-a5d0-c2584f70524e', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('e7f53548-72c4-4f66-a577-48f43079ed32', 'fa0ebfce-b12f-4846-a72f-f036fa7895ea', '07e45028-cd9e-4cfa-8540-a8d47f04350e', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('05e16e3f-6af1-4183-9563-bdf7214487e7', 'fa0ebfce-b12f-4846-a72f-f036fa7895ea', 'fbbe2c5f-9431-4317-a3c2-30975de07a03', 'Out of Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('3400d26c-b32e-4ef0-b6c7-124416090f44', 'fa0ebfce-b12f-4846-a72f-f036fa7895ea', '40442b0c-7fbb-4904-8d58-49648318a220', 'In Stock', 'https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg'),
  ('50d9ad8c-84a1-4674-8b6c-417cc2b04650', 'e66a49a0-c820-438e-9cc3-420cf130f41a', 'a2e31a02-8744-46d8-83e0-7c5676337b04', 'In Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('4e274396-c596-44b4-878d-6332a31c5390', 'e66a49a0-c820-438e-9cc3-420cf130f41a', 'a9473838-934a-41f0-97a6-5780eac171cc', 'In Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('c3f53d77-35da-4d79-bf0f-63837719e865', 'e66a49a0-c820-438e-9cc3-420cf130f41a', '9f29c119-63f1-4f15-b5d7-fdf1ad211921', 'In Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('406b1caf-cddc-4971-ad28-afe35fe539bd', 'e66a49a0-c820-438e-9cc3-420cf130f41a', '4fff1581-667f-427d-a2fc-35e183ad6af9', 'In Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('d32093bc-ae81-4d24-9bd9-f38448651d38', 'e66a49a0-c820-438e-9cc3-420cf130f41a', '0e1c4e92-8d2c-4ef0-9680-efb6de2b8f14', 'In Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('b86c310a-ff94-4adc-bef7-e9e6018b2978', 'e66a49a0-c820-438e-9cc3-420cf130f41a', 'b240e344-c47b-46b8-8230-1a6c07f8b574', 'In Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('d0d93501-8731-42d7-910e-50d5d6adeb8b', 'e66a49a0-c820-438e-9cc3-420cf130f41a', '8dcdc32f-c61a-402b-9e6c-9a471303f6cf', 'In Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('6865f9a2-ef0c-412e-956b-cbea1bfbc1da', 'e66a49a0-c820-438e-9cc3-420cf130f41a', '2ac508cc-c9cf-4e52-a5d0-c2584f70524e', 'In Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('51c7e306-b04f-413e-a0a4-ecc6692e3432', 'e66a49a0-c820-438e-9cc3-420cf130f41a', '07e45028-cd9e-4cfa-8540-a8d47f04350e', 'In Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('29793491-46b5-4ccb-a6e3-aacd89abb0e7', 'e66a49a0-c820-438e-9cc3-420cf130f41a', 'fbbe2c5f-9431-4317-a3c2-30975de07a03', 'Out of Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('0d9e6282-f372-4e38-b3d0-819ec90bd844', 'e66a49a0-c820-438e-9cc3-420cf130f41a', '40442b0c-7fbb-4904-8d58-49648318a220', 'In Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('f2f69bc5-6c58-4c87-b200-47014e564bbb', '67007629-9d00-4369-8e37-9019da363a7d', 'a2e31a02-8744-46d8-83e0-7c5676337b04', 'In Stock', 'https://user.uploads.dev/file/34617d0c153b8681923b720db8360a15.jpg'),
  ('82aa8faf-b097-4dc9-a335-29330b2c7875', '67007629-9d00-4369-8e37-9019da363a7d', 'a9473838-934a-41f0-97a6-5780eac171cc', 'In Stock', 'https://user.uploads.dev/file/34617d0c153b8681923b720db8360a15.jpg'),
  ('5685d44e-b765-42a8-b8f0-f75a3b0092d4', '67007629-9d00-4369-8e37-9019da363a7d', '9f29c119-63f1-4f15-b5d7-fdf1ad211921', 'Low Stock', 'https://user.uploads.dev/file/34617d0c153b8681923b720db8360a15.jpg'),
  ('c5637716-22a4-4d44-9cfe-cc3207861a50', '67007629-9d00-4369-8e37-9019da363a7d', '4fff1581-667f-427d-a2fc-35e183ad6af9', 'In Stock', 'https://user.uploads.dev/file/34617d0c153b8681923b720db8360a15.jpg'),
  ('ed184165-00e4-4eb5-b3a7-f0d566edf859', '67007629-9d00-4369-8e37-9019da363a7d', '0e1c4e92-8d2c-4ef0-9680-efb6de2b8f14', 'In Stock', 'https://user.uploads.dev/file/34617d0c153b8681923b720db8360a15.jpg'),
  ('8b33c263-9387-4c0f-b194-4393c32530a3', '67007629-9d00-4369-8e37-9019da363a7d', 'b240e344-c47b-46b8-8230-1a6c07f8b574', 'In Stock', 'https://user.uploads.dev/file/34617d0c153b8681923b720db8360a15.jpg'),
  ('9bcd00f8-d824-46ae-8ebd-9d447c5a5062', '67007629-9d00-4369-8e37-9019da363a7d', '8dcdc32f-c61a-402b-9e6c-9a471303f6cf', 'In Stock', 'https://user.uploads.dev/file/34617d0c153b8681923b720db8360a15.jpg'),
  ('81e83adb-37d8-4c07-8fad-7c23f1816763', '67007629-9d00-4369-8e37-9019da363a7d', '2ac508cc-c9cf-4e52-a5d0-c2584f70524e', 'In Stock', 'https://user.uploads.dev/file/34617d0c153b8681923b720db8360a15.jpg'),
  ('ba48b4bf-5500-4df7-ac99-fc07af3b1d7b', '67007629-9d00-4369-8e37-9019da363a7d', '07e45028-cd9e-4cfa-8540-a8d47f04350e', 'In Stock', 'https://user.uploads.dev/file/34617d0c153b8681923b720db8360a15.jpg'),
  ('63633eb8-48a5-4578-89ac-d5d0257d1c8c', '67007629-9d00-4369-8e37-9019da363a7d', 'fbbe2c5f-9431-4317-a3c2-30975de07a03', 'In Stock', 'https://user.uploads.dev/file/34617d0c153b8681923b720db8360a15.jpg'),
  ('4a050c0b-cdc5-4677-8012-2fe39ca41d4b', '67007629-9d00-4369-8e37-9019da363a7d', '40442b0c-7fbb-4904-8d58-49648318a220', 'In Stock', 'https://user.uploads.dev/file/34617d0c153b8681923b720db8360a15.jpg'),
  ('b1033c0c-8fa7-4b6e-9043-f1b0bcf6ba32', '89e325a0-aa44-4620-abb2-e1201c1614d4', 'a2e31a02-8744-46d8-83e0-7c5676337b04', 'In Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('692dba16-3e01-4906-a3d7-9cf6f174659a', '89e325a0-aa44-4620-abb2-e1201c1614d4', 'a9473838-934a-41f0-97a6-5780eac171cc', 'In Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('828b43f7-b57d-4053-8115-f5774aa186a7', '89e325a0-aa44-4620-abb2-e1201c1614d4', '9f29c119-63f1-4f15-b5d7-fdf1ad211921', 'In Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('ff01232f-5838-4683-adb8-6557b93c2537', '89e325a0-aa44-4620-abb2-e1201c1614d4', '4fff1581-667f-427d-a2fc-35e183ad6af9', 'Low Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('0c13ba3c-3d42-4752-85dd-7578990ccd8e', '89e325a0-aa44-4620-abb2-e1201c1614d4', '0e1c4e92-8d2c-4ef0-9680-efb6de2b8f14', 'Low Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('eb669f8a-cb91-4732-9196-5092dd3b66e6', '89e325a0-aa44-4620-abb2-e1201c1614d4', 'b240e344-c47b-46b8-8230-1a6c07f8b574', 'Low Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('8f6f3b81-ac02-46fd-bdd5-2bf1309a6119', '89e325a0-aa44-4620-abb2-e1201c1614d4', '8dcdc32f-c61a-402b-9e6c-9a471303f6cf', 'Low Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('836c7022-5401-4e28-9375-d46668ac0eec', '89e325a0-aa44-4620-abb2-e1201c1614d4', '2ac508cc-c9cf-4e52-a5d0-c2584f70524e', 'Low Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('6cce5986-6e7b-4c70-bcf6-147a947cd77c', '89e325a0-aa44-4620-abb2-e1201c1614d4', '07e45028-cd9e-4cfa-8540-a8d47f04350e', 'In Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('bc495311-d185-4b0d-b00f-1d89fa1ce7b1', '89e325a0-aa44-4620-abb2-e1201c1614d4', 'fbbe2c5f-9431-4317-a3c2-30975de07a03', 'In Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg'),
  ('6dc7f102-d56a-410e-97a8-62aa65336ba2', '89e325a0-aa44-4620-abb2-e1201c1614d4', '40442b0c-7fbb-4904-8d58-49648318a220', 'In Stock', 'https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg')
on conflict (id) do update set
  product_id = excluded.product_id, color_id = excluded.color_id,
  stock_status = excluded.stock_status, image_url = excluded.image_url;

-- -------------------------------------------------------------- summary
select 'colours' as table, count(*) from public.colors
union all select 'products', count(*) from public.products
union all select 'product_variants', count(*) from public.product_variants;

-- Next: sign up in the storefront, then use "Load demo orders" on the
-- Database page (or call select public.seed_demo_orders();) to fill your
-- account with the four example orders.
