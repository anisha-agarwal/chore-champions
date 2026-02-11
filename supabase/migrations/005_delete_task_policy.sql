-- Migration: Delete task RLS policies
-- Issue: #5 - Delete Task Feature

-- Note: Parent delete policy already exists in 001_initial_schema.sql
-- "Family parents can delete tasks"

-- Kids can only delete tasks they created
CREATE POLICY "Kids can delete their own created tasks"
  ON tasks FOR DELETE
  USING (created_by = auth.uid());
