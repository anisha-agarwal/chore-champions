-- ============================================================
-- 018: Initiative bonus — reward kids who pick up unassigned tasks
-- ============================================================
-- When an unassigned task is self-assigned by a kid and later completed,
-- they earn a 50% bonus on top of base (or overdue-halved) points.

ALTER TABLE tasks
  ADD COLUMN self_assigned boolean NOT NULL DEFAULT false;

ALTER TABLE task_completions
  ADD COLUMN bonus_applied boolean NOT NULL DEFAULT false;
