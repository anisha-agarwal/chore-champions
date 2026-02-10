-- RLS policy: users can delete their own completions, parents can delete any in family
CREATE POLICY "Users can delete completions"
  ON task_completions FOR DELETE
  USING (
    completed_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'parent'
        AND family_id IN (
          SELECT family_id FROM tasks WHERE id = task_completions.task_id
        )
    )
  );

-- Trigger to deduct points on delete (mirrors award_points_on_completion)
CREATE OR REPLACE FUNCTION deduct_points_on_completion_delete()
RETURNS trigger AS $$
BEGIN
  UPDATE profiles
  SET points = GREATEST(points - OLD.points_earned, 0)
  WHERE id = OLD.completed_by;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_task_completion_deleted
  BEFORE DELETE ON task_completions
  FOR EACH ROW EXECUTE FUNCTION deduct_points_on_completion_delete();
