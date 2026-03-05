-- Streak tracking tables and RPC functions
-- Supports: task streaks, perfect day streaks, active day streaks

-- Streak freezes: available freeze count per user
CREATE TABLE streak_freezes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  available int NOT NULL DEFAULT 0,
  used int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_streak_freezes_user ON streak_freezes(user_id);

ALTER TABLE streak_freezes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own freezes" ON streak_freezes
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own freezes" ON streak_freezes
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own freezes" ON streak_freezes
  FOR UPDATE USING (user_id = auth.uid());

-- Streak milestones: claimed milestone records (prevents double-awarding)
CREATE TABLE streak_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  streak_type text NOT NULL CHECK (streak_type IN ('task', 'perfect_day', 'active_day')),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  milestone_days int NOT NULL CHECK (milestone_days IN (7, 14, 30, 60, 100)),
  points_awarded int NOT NULL,
  badge_name text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_streak_milestones_unique ON streak_milestones(
  user_id, streak_type, COALESCE(task_id, '00000000-0000-0000-0000-000000000000'::uuid), milestone_days
);

ALTER TABLE streak_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own milestones" ON streak_milestones
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own milestones" ON streak_milestones
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Streak freeze usage: log of which dates freezes were applied
CREATE TABLE streak_freeze_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  freeze_date date NOT NULL,
  streak_type text NOT NULL CHECK (streak_type IN ('task', 'perfect_day', 'active_day')),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  used_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_streak_freeze_usage_unique ON streak_freeze_usage(
  user_id, freeze_date, streak_type, COALESCE(task_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

ALTER TABLE streak_freeze_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own freeze usage" ON streak_freeze_usage
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own freeze usage" ON streak_freeze_usage
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- RPC: get_user_streaks
-- Computes current streaks from task_completions data.
-- [7] Uses set-based queries: fetches all completion dates and freeze dates upfront,
-- then iterates in memory instead of running per-day queries.
-- [4] Note: perfect day streak uses current task assignments. If tasks were added/removed
-- historically, past perfect day counts may not reflect what was assigned on that date.
CREATE OR REPLACE FUNCTION get_user_streaks(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_active_day_streak int := 0;
  v_perfect_day_streak int := 0;
  v_task_streaks jsonb := '[]'::jsonb;
  v_check_date date;
  v_daily_task_count int;
  v_task record;
  v_task_streak int;
  -- Pre-fetched date sets
  v_completion_dates date[];
  v_active_freeze_dates date[];
  v_perfect_freeze_dates date[];
  v_task_completion_dates date[];
  v_task_freeze_dates date[];
BEGIN
  -- [2] Auth check
  IF p_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  -- Pre-fetch all completion dates for this user (set-based)
  SELECT ARRAY_AGG(DISTINCT tc.completion_date::date)
  INTO v_completion_dates
  FROM task_completions tc
  WHERE tc.completed_by = p_user_id;

  -- Pre-fetch freeze dates by type
  SELECT ARRAY_AGG(DISTINCT freeze_date)
  INTO v_active_freeze_dates
  FROM streak_freeze_usage
  WHERE user_id = p_user_id AND streak_type = 'active_day';

  SELECT ARRAY_AGG(DISTINCT freeze_date)
  INTO v_perfect_freeze_dates
  FROM streak_freeze_usage
  WHERE user_id = p_user_id AND streak_type = 'perfect_day';

  -- Coalesce NULLs to empty arrays
  v_completion_dates := COALESCE(v_completion_dates, '{}');
  v_active_freeze_dates := COALESCE(v_active_freeze_dates, '{}');
  v_perfect_freeze_dates := COALESCE(v_perfect_freeze_dates, '{}');

  -- Active Day Streak: at least 1 completion per day
  v_check_date := CURRENT_DATE;
  LOOP
    IF v_check_date = ANY(v_completion_dates) OR v_check_date = ANY(v_active_freeze_dates) THEN
      v_active_day_streak := v_active_day_streak + 1;
      v_check_date := v_check_date - 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  -- Perfect Day Streak: all assigned daily tasks completed
  -- Count daily tasks assigned to user (current assignment state)
  SELECT COUNT(*) INTO v_daily_task_count
  FROM tasks
  WHERE assigned_to = p_user_id
    AND recurring = 'daily';

  IF v_daily_task_count > 0 THEN
    v_check_date := CURRENT_DATE;
    LOOP
      DECLARE
        v_completed_count int;
      BEGIN
        SELECT COUNT(DISTINCT tc.task_id) INTO v_completed_count
        FROM task_completions tc
        JOIN tasks t ON tc.task_id = t.id
        WHERE tc.completed_by = p_user_id
          AND tc.completion_date = v_check_date::text
          AND t.recurring = 'daily'
          AND t.assigned_to = p_user_id;

        IF v_completed_count >= v_daily_task_count OR v_check_date = ANY(v_perfect_freeze_dates) THEN
          v_perfect_day_streak := v_perfect_day_streak + 1;
          v_check_date := v_check_date - 1;
        ELSE
          EXIT;
        END IF;
      END;
    END LOOP;
  END IF;

  -- Task Streaks: per daily recurring task
  FOR v_task IN
    SELECT t.id, t.title
    FROM tasks t
    WHERE t.assigned_to = p_user_id
      AND t.recurring = 'daily'
    ORDER BY t.title
  LOOP
    v_task_streak := 0;
    v_check_date := CURRENT_DATE;

    -- Pre-fetch completion dates for this specific task
    SELECT ARRAY_AGG(DISTINCT tc.completion_date::date)
    INTO v_task_completion_dates
    FROM task_completions tc
    WHERE tc.task_id = v_task.id
      AND tc.completed_by = p_user_id;

    SELECT ARRAY_AGG(DISTINCT freeze_date)
    INTO v_task_freeze_dates
    FROM streak_freeze_usage
    WHERE user_id = p_user_id
      AND streak_type = 'task'
      AND task_id = v_task.id;

    v_task_completion_dates := COALESCE(v_task_completion_dates, '{}');
    v_task_freeze_dates := COALESCE(v_task_freeze_dates, '{}');

    LOOP
      IF v_check_date = ANY(v_task_completion_dates) OR v_check_date = ANY(v_task_freeze_dates) THEN
        v_task_streak := v_task_streak + 1;
        v_check_date := v_check_date - 1;
      ELSE
        EXIT;
      END IF;
    END LOOP;

    v_task_streaks := v_task_streaks || jsonb_build_object(
      'task_id', v_task.id,
      'title', v_task.title,
      'current_streak', v_task_streak
    );
  END LOOP;

  RETURN jsonb_build_object(
    'active_day_streak', v_active_day_streak,
    'perfect_day_streak', v_perfect_day_streak,
    'task_streaks', v_task_streaks
  );
END;
$$;

-- RPC: buy_streak_freeze
-- [1] Uses atomic UPDATE...WHERE points >= 50 to prevent TOCTOU race
-- [2] Verifies p_user_id = auth.uid()
CREATE OR REPLACE FUNCTION buy_streak_freeze(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_affected int;
BEGIN
  -- [2] Auth check
  IF p_user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- [1] Atomic deduct: only succeeds if points >= 50
  UPDATE profiles SET points = points - 50
  WHERE id = p_user_id AND points >= 50;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not enough points (need 50)');
  END IF;

  -- Increment available freezes
  INSERT INTO streak_freezes (user_id, available, used)
  VALUES (p_user_id, 1, 0)
  ON CONFLICT (user_id)
  DO UPDATE SET available = streak_freezes.available + 1, updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: use_streak_freeze
-- [3] Uses atomic UPDATE...WHERE available > used to prevent TOCTOU race
-- [2] Verifies p_user_id = auth.uid()
CREATE OR REPLACE FUNCTION use_streak_freeze(p_user_id uuid, p_freeze_date date, p_streak_type text, p_task_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_affected int;
BEGIN
  -- [2] Auth check
  IF p_user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- [3] Atomic: only increments used if available > used
  UPDATE streak_freezes
  SET used = used + 1, updated_at = now()
  WHERE user_id = p_user_id AND available > used;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No freezes available');
  END IF;

  -- Insert freeze usage record
  INSERT INTO streak_freeze_usage (user_id, freeze_date, streak_type, task_id)
  VALUES (p_user_id, p_freeze_date, p_streak_type, p_task_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: claim_streak_milestone
-- [2] Verifies p_user_id = auth.uid()
-- [8] Note: bonus/badge values are duplicated in lib/streaks.ts STREAK_MILESTONES.
--     If milestone values change, update both this function and the TypeScript constant.
CREATE OR REPLACE FUNCTION claim_streak_milestone(
  p_user_id uuid,
  p_streak_type text,
  p_task_id uuid,
  p_milestone_days int,
  p_current_streak int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bonus int;
  v_badge text;
BEGIN
  -- [2] Auth check
  IF p_user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Validate streak meets milestone
  IF p_current_streak < p_milestone_days THEN
    RETURN jsonb_build_object('success', false, 'error', 'Streak not long enough');
  END IF;

  -- Determine bonus and badge
  v_bonus := CASE p_milestone_days
    WHEN 7 THEN 50
    WHEN 14 THEN 100
    WHEN 30 THEN 250
    WHEN 60 THEN 500
    WHEN 100 THEN 1000
    ELSE 0
  END;

  v_badge := CASE p_milestone_days
    WHEN 7 THEN 'Week Warrior'
    WHEN 14 THEN 'Fortnight Fighter'
    WHEN 30 THEN 'Monthly Master'
    WHEN 60 THEN 'Sixty-Day Sage'
    WHEN 100 THEN 'Century Champion'
    ELSE 'Unknown'
  END;

  -- Insert milestone (unique index prevents dupes)
  BEGIN
    INSERT INTO streak_milestones (user_id, streak_type, task_id, milestone_days, points_awarded, badge_name)
    VALUES (p_user_id, p_streak_type, NULLIF(p_task_id, '00000000-0000-0000-0000-000000000000'::uuid), p_milestone_days, v_bonus, v_badge);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Milestone already claimed');
  END;

  -- Award bonus points
  UPDATE profiles SET points = points + v_bonus WHERE id = p_user_id;

  -- Award free freeze at 30-day and 100-day milestones
  IF p_milestone_days IN (30, 100) THEN
    INSERT INTO streak_freezes (user_id, available, used)
    VALUES (p_user_id, 1, 0)
    ON CONFLICT (user_id)
    DO UPDATE SET available = streak_freezes.available + 1, updated_at = now();
  END IF;

  RETURN jsonb_build_object('success', true, 'bonus', v_bonus, 'badge', v_badge);
END;
$$;
