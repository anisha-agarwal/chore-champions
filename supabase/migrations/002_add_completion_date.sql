ALTER TABLE task_completions ADD COLUMN completion_date date;

-- Backfill existing rows
UPDATE task_completions
SET completion_date = (completed_at AT TIME ZONE 'UTC')::date
WHERE completion_date IS NULL;

-- Remove duplicate completions per task per day, keeping the earliest
DELETE FROM task_completions a
USING task_completions b
WHERE a.task_id = b.task_id
  AND a.completion_date = b.completion_date
  AND a.completion_date IS NOT NULL
  AND a.completed_at > b.completed_at;

-- Index for fast date lookups
CREATE INDEX idx_task_completions_date ON task_completions(completion_date);

-- Prevent duplicate completions per task per day
CREATE UNIQUE INDEX idx_task_completions_unique_per_day
ON task_completions(task_id, completion_date)
WHERE completion_date IS NOT NULL;
