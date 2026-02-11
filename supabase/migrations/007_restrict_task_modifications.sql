-- Migration: Restrict task modifications for kids
-- Issue: #5 - Kids should only modify tasks they created

-- Drop the existing permissive update policy
DROP POLICY IF EXISTS "Family members can update tasks" ON tasks;

-- Parents can update any task in their family
CREATE POLICY "Family parents can update tasks"
  ON tasks FOR UPDATE
  USING (family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid() AND role = 'parent'));

-- Kids can only update tasks they created
CREATE POLICY "Kids can update their own created tasks"
  ON tasks FOR UPDATE
  USING (created_by = auth.uid());

-- Update task_skips policies to restrict kids
DROP POLICY IF EXISTS "Family members can create task skips" ON task_skips;

-- Parents can skip any task in their family
CREATE POLICY "Parents can skip any family task"
  ON task_skips FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN profiles p ON p.family_id = t.family_id
      WHERE p.id = auth.uid() AND p.role = 'parent'
    )
  );

-- Kids can only skip tasks they created
CREATE POLICY "Kids can skip their own created tasks"
  ON task_skips FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT id FROM tasks WHERE created_by = auth.uid()
    )
  );
