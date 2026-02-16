-- Invite existing user to family by email
-- Issue #6: In-app invite system using email lookup

-- New table to track family invites
CREATE TABLE family_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES profiles(id),
  invited_user_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  -- Cannot invite yourself
  CONSTRAINT no_self_invite CHECK (invited_user_id != invited_by)
);

-- Prevent duplicate pending invites for the same user in the same family
CREATE UNIQUE INDEX idx_unique_pending_invite
  ON family_invites (family_id, invited_user_id)
  WHERE status = 'pending';

-- Enable RLS
ALTER TABLE family_invites ENABLE ROW LEVEL SECURITY;

-- SELECT: Parents see their family's invites; invited users see their own
CREATE POLICY "Users can view relevant invites"
  ON family_invites FOR SELECT
  USING (
    invited_user_id = auth.uid()
    OR (
      family_id IN (
        SELECT p.family_id FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'parent'
      )
    )
  );

-- INSERT: Only parents can create invites for their family
CREATE POLICY "Parents can create invites"
  ON family_invites FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND family_id IN (
      SELECT p.family_id FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'parent'
    )
  );

-- UPDATE: Only invited user can respond to their own pending invites
CREATE POLICY "Invited users can respond to invites"
  ON family_invites FOR UPDATE
  USING (
    invited_user_id = auth.uid()
    AND status = 'pending'
  )
  WITH CHECK (
    invited_user_id = auth.uid()
    AND status IN ('accepted', 'declined')
  );

-- Secure email lookup: resolves email to user info without exposing emails
CREATE OR REPLACE FUNCTION find_user_by_email(lookup_email TEXT)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  has_family BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.display_name,
    p.avatar_url,
    (p.family_id IS NOT NULL) AS has_family
  FROM auth.users u
  JOIN profiles p ON p.id = u.id
  WHERE u.email = lookup_email
  LIMIT 1;
END;
$$;

-- Atomic accept: updates invite status and sets user's family_id in one transaction
CREATE OR REPLACE FUNCTION accept_family_invite(invite_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite family_invites%ROWTYPE;
BEGIN
  -- Fetch and validate the invite
  SELECT * INTO v_invite
  FROM family_invites
  WHERE id = invite_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF v_invite.status != 'pending' THEN
    RAISE EXCEPTION 'Invite is no longer pending';
  END IF;

  IF v_invite.invited_user_id != auth.uid() THEN
    RAISE EXCEPTION 'This invite is not for you';
  END IF;

  -- Check that the caller has no current family
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND family_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'You are already in a family';
  END IF;

  -- Atomically update invite status and set family_id
  UPDATE family_invites
  SET status = 'accepted', responded_at = now()
  WHERE id = invite_id;

  UPDATE profiles
  SET family_id = v_invite.family_id
  WHERE id = auth.uid();
END;
$$;
