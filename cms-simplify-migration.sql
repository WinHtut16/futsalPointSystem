-- cms-simplify-migration.sql
-- Adds source_url and manual_image_url columns to cms_posts.
-- body_md, body_my_md, and cover_url are already nullable — no structural change needed for them.
-- Run in Supabase SQL editor after booking-system-migration.sql.

ALTER TABLE public.cms_posts
  ADD COLUMN IF NOT EXISTS source_url        text,
  ADD COLUMN IF NOT EXISTS manual_image_url  text;
