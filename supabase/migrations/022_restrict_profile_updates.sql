-- ============================================================
-- 022: Restrict profile UPDATE — block role/points/family_id from clients
-- ============================================================
-- Previously the profile UPDATE policy only checked USING (id = auth.uid()).
-- Without column restrictions or a WITH CHECK clause, any authenticated
-- user could:
--   UPDATE profiles SET role = 'parent', points = 999999, family_id = '<any>'
--                   WHERE id = auth.uid();
-- via the anon key, breaking the entire trust model.
--
-- This migration:
--   1. Replaces the policy with a version that has both USING and WITH CHECK.
--   2. Adds a BEFORE UPDATE trigger that rejects changes to role / points /
--      family_id from authenticated callers. Service role and SECURITY
--      DEFINER RPCs bypass (their current_user is the function owner).
--   3. Adds two SECURITY DEFINER RPCs as the only legitimate way to
--      mutate role + family_id from the client:
--         - create_family_as_parent(name)        — creator becomes parent
--         - join_family_via_invite_code(code)    — joiner stays as child

-- ------------------------------------------------------------
-- (1) Tighten the existing UPDATE policy
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- The migration-009 "Parents can remove family members" policy is left
-- in place; the new trigger below tightens what columns can change in
-- that flow.

-- ------------------------------------------------------------
-- (2) Trigger: forbid sensitive column changes from clients
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_profile_update_constraints()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Service role and SECURITY DEFINER calls run as the function owner
  -- (e.g. 'postgres' / 'supabase_admin' / 'service_role'), so they bypass.
  -- Only the 'authenticated' role — used by user-driven REST calls — is
  -- subjected to the constraints.
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF NEW.id = auth.uid() THEN
    -- Self-update: block sensitive columns.
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot change role directly; use create_family_as_parent()';
    END IF;
    IF NEW.points IS DISTINCT FROM OLD.points THEN
      RAISE EXCEPTION 'Cannot change points directly; awarded only via task completions';
    END IF;
    IF NEW.family_id IS DISTINCT FROM OLD.family_id THEN
      RAISE EXCEPTION 'Cannot change family_id directly; use create_family_as_parent() or join_family_via_invite_code()';
    END IF;
    RETURN NEW;
  END IF;

  -- Updating another user's profile: only legal when a parent is removing
  -- a family member (migration 009). Allow ONLY family_id -> NULL.
  IF NEW.family_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot set family_id on another user; only NULL is permitted (removal flow)';
  END IF;
  IF NEW.role            IS DISTINCT FROM OLD.role
     OR NEW.points       IS DISTINCT FROM OLD.points
     OR NEW.display_name IS DISTINCT FROM OLD.display_name
     OR NEW.avatar_url   IS DISTINCT FROM OLD.avatar_url
     OR NEW.nickname     IS DISTINCT FROM OLD.nickname THEN
    RAISE EXCEPTION 'Removal flow may only clear family_id; no other columns may change';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_update_constraints_trigger ON profiles;

CREATE TRIGGER enforce_profile_update_constraints_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_profile_update_constraints();

-- ------------------------------------------------------------
-- (3) RPC: create a family and become its parent
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_family_as_parent(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_existing  uuid;
  v_family_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Family name required';
  END IF;

  SELECT family_id INTO v_existing FROM profiles WHERE id = v_user_id;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'User is already in a family';
  END IF;

  INSERT INTO families (name) VALUES (trim(p_name))
  RETURNING id INTO v_family_id;

  UPDATE profiles
  SET family_id = v_family_id, role = 'parent'
  WHERE id = v_user_id;

  RETURN v_family_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_family_as_parent(text) TO authenticated;

-- ------------------------------------------------------------
-- (4) RPC: join an existing family via invite code (joiner stays child)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION join_family_via_invite_code(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_existing  uuid;
  v_family_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RAISE EXCEPTION 'Invite code required';
  END IF;

  SELECT family_id INTO v_existing FROM profiles WHERE id = v_user_id;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'User is already in a family';
  END IF;

  -- Match invite_code case-insensitively (consistent with migration 008).
  SELECT id INTO v_family_id
  FROM families
  WHERE LOWER(invite_code) = LOWER(trim(p_code));

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  UPDATE profiles
  SET family_id = v_family_id
  WHERE id = v_user_id;

  RETURN v_family_id;
END;
$$;

GRANT EXECUTE ON FUNCTION join_family_via_invite_code(text) TO authenticated;
