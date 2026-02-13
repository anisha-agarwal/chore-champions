-- Remove family member feature
-- Issue #8: Add ability to remove a person from family

-- Allow parents to remove members from their family
-- (update other profiles' family_id to null)
CREATE POLICY "Parents can remove family members"
  ON profiles FOR UPDATE
  USING (
    -- Current user must be a parent in the same family
    family_id IN (
      SELECT family_id FROM profiles
      WHERE id = auth.uid() AND role = 'parent'
    )
    -- Cannot remove yourself
    AND id != auth.uid()
  )
  WITH CHECK (
    -- Can only set family_id to null (removal)
    family_id IS NULL
  );

-- Trigger to unassign tasks when a member is removed from family
CREATE OR REPLACE FUNCTION unassign_tasks_on_family_removal()
RETURNS trigger AS $$
BEGIN
  -- If family_id changed from a value to null, unassign their tasks
  IF OLD.family_id IS NOT NULL AND NEW.family_id IS NULL THEN
    UPDATE tasks
    SET assigned_to = NULL
    WHERE assigned_to = NEW.id
      AND family_id = OLD.family_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_member_removed
  AFTER UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.family_id IS DISTINCT FROM NEW.family_id)
  EXECUTE FUNCTION unassign_tasks_on_family_removal();
