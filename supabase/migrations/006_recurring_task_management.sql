-- Migration: Recurring task management (skip today, end recurring)
-- Issue: #5 - Delete Task Feature (recurring task handling)

-- Add end_date column to tasks for "Delete all future" functionality
-- When set, recurring tasks stop appearing after this date
ALTER TABLE tasks ADD COLUMN end_date date;

-- Create task_skips table for "Skip today" functionality
-- Tracks which dates a recurring task should be hidden
CREATE TABLE task_skips (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  skip_date date NOT NULL,
  skipped_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(task_id, skip_date)
);

-- Create index for better query performance
CREATE INDEX idx_task_skips_task_id ON task_skips(task_id);
CREATE INDEX idx_task_skips_skip_date ON task_skips(skip_date);

-- Enable Row Level Security
ALTER TABLE task_skips ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_skips

-- Users can view skips for tasks in their family
CREATE POLICY "Users can view task skips in their family"
  ON task_skips FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Family members can create skips for tasks in their family
CREATE POLICY "Family members can create task skips"
  ON task_skips FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT id FROM tasks
      WHERE family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Family members can delete skips (to unskip a task)
CREATE POLICY "Family members can delete task skips"
  ON task_skips FOR DELETE
  USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
    )
  );
