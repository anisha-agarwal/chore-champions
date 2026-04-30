-- ============================================================
-- 020: Restrict task creation + enforce completed_by = auth.uid()
-- ============================================================
-- Previously any family member could INSERT tasks with arbitrary points
-- and arbitrary assigned_to, and could INSERT task_completions with
-- completed_by set to any family member. Combined, a kid could mint
-- unlimited points for themselves (or swap attribution onto a sibling).
--
-- This migration:
--   1. Restricts tasks INSERT to parents only.
--   2. Forces task_completions INSERT to set completed_by = auth.uid().
--
-- It drops ALL existing INSERT policies on both tables (including an
-- out-of-band "Users can create family tasks" / "Users can create completions"
-- pair added via the dashboard) so the stricter replacements are not
-- OR'd away by more permissive siblings.

-- Tasks INSERT: clear all, install parents-only
DROP POLICY IF EXISTS "Family members can create tasks" ON tasks;
DROP POLICY IF EXISTS "Users can create family tasks" ON tasks;
DROP POLICY IF EXISTS "Family parents can create tasks" ON tasks;

CREATE POLICY "Family parents can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM profiles
      WHERE id = auth.uid() AND role = 'parent'
    )
  );

-- task_completions INSERT: clear all, require completed_by = auth.uid()
DROP POLICY IF EXISTS "Family members can create completions" ON task_completions;
DROP POLICY IF EXISTS "Users can create completions" ON task_completions;
DROP POLICY IF EXISTS "Users can only complete tasks as themselves" ON task_completions;

CREATE POLICY "Users can only complete tasks as themselves"
  ON task_completions FOR INSERT
  WITH CHECK (
    completed_by = auth.uid()
    AND task_id IN (
      SELECT id FROM tasks
      WHERE family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
    )
  );
