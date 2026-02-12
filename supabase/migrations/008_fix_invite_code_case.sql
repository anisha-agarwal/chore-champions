-- Fix invite code lookup to be case-insensitive
-- Issue #4: Signup with family invite code not working

-- Update the get_family_by_invite_code function to use case-insensitive comparison
CREATE OR REPLACE FUNCTION get_family_by_invite_code(code text)
RETURNS TABLE (id uuid, name text) AS $$
BEGIN
  RETURN QUERY SELECT families.id, families.name FROM families WHERE LOWER(invite_code) = LOWER(code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
