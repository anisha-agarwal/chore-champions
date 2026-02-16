-- Add optional due_time column for time-sensitive tasks
ALTER TABLE tasks ADD COLUMN due_time time;

-- Partial index for efficient querying of tasks with due times
CREATE INDEX idx_tasks_due_time ON tasks(due_time) WHERE due_time IS NOT NULL;
