-- ============================================================
-- handle_new_user trigger fix
-- Prevents "Database error creating new user" when creating
-- users via the Supabase Auth dashboard (which sends no
-- raw_user_meta_data), caused by NULL being inserted into
-- the NOT NULL profiles.username column.
-- Fix: COALESCE falls back to the email prefix when username
-- is absent from metadata.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, username, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'phone',
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    'customer'
  );
  RETURN new;
END;
$$;
