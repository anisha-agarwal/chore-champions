-- ============================================================
-- 019: Ignore client-supplied role in signup metadata
-- ============================================================
-- The previous trigger read role from raw_user_meta_data, which is fully
-- client-controlled via supabase.auth.signUp({ options: { data: { role: 'parent' }}}).
-- Always default role to 'child'. Parent role is assigned only by server-side
-- flows (family creation), never by user input at signup.
--
-- Also adds SET search_path to prevent search-path hijacks on SECURITY DEFINER.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO profiles (id, display_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'child'
  );
  RETURN NEW;
END;
$$;
