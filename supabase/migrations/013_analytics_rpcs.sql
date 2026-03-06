-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_task_completions_user_date
  ON task_completions(completed_by, completion_date);

CREATE INDEX IF NOT EXISTS idx_task_completions_task_date
  ON task_completions(task_id, completion_date DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_family_role
  ON profiles(family_id, role);

CREATE INDEX IF NOT EXISTS idx_tasks_family_assigned
  ON tasks(family_id, assigned_to);

-- RPC: get_kid_analytics
-- Returns trend data + task breakdown + milestones for a single child
CREATE OR REPLACE FUNCTION get_kid_analytics(p_user_id uuid, p_weeks integer DEFAULT 12)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_start_date date;
  v_week_start date;
  v_last_week_start date;
  v_result jsonb;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  p_weeks := GREATEST(1, LEAST(52, p_weeks));
  v_start_date := current_date - (p_weeks * 7);
  -- Sunday-start week
  v_week_start := current_date - EXTRACT(DOW FROM current_date)::integer;
  v_last_week_start := v_week_start - 7;

  SELECT jsonb_build_object(
    'daily_points', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'date', d.completion_date,
        'points', d.total_points,
        'completions', d.total_completions
      ) ORDER BY d.completion_date)
      FROM (
        SELECT completion_date,
               SUM(points_earned) as total_points,
               COUNT(*) as total_completions
        FROM task_completions
        WHERE completed_by = p_user_id
          AND completion_date >= v_start_date
        GROUP BY completion_date
      ) d
    ), '[]'::jsonb),
    'task_breakdown', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'task_id', tc.task_id,
        'title', t.title,
        'count', tc.cnt
      ) ORDER BY tc.cnt DESC)
      FROM (
        SELECT task_id, COUNT(*) as cnt
        FROM task_completions
        WHERE completed_by = p_user_id
          AND completion_date >= v_start_date
        GROUP BY task_id
      ) tc
      JOIN tasks t ON t.id = tc.task_id
    ), '[]'::jsonb),
    'milestones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'streak_type', sm.streak_type,
        'task_id', sm.task_id,
        'milestone_days', sm.milestone_days,
        'badge_name', sm.badge_name,
        'claimed_at', sm.claimed_at
      ) ORDER BY sm.milestone_days ASC)
      FROM streak_milestones sm
      WHERE sm.user_id = p_user_id
    ), '[]'::jsonb),
    'total_points', COALESCE((SELECT points FROM profiles WHERE id = p_user_id), 0),
    'completions_this_week', (
      SELECT COUNT(*)
      FROM task_completions
      WHERE completed_by = p_user_id
        AND completion_date >= v_week_start
    ),
    'completions_last_week', (
      SELECT COUNT(*)
      FROM task_completions
      WHERE completed_by = p_user_id
        AND completion_date >= v_last_week_start
        AND completion_date < v_week_start
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- RPC: get_kid_heatmap
-- Returns 52 weeks of daily completion data for the streak heatmap
CREATE OR REPLACE FUNCTION get_kid_heatmap(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_heatmap_start date;
  v_result jsonb;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_heatmap_start := current_date - 364;

  SELECT jsonb_build_object(
    'heatmap_data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'date', h.completion_date,
        'points', h.total_points,
        'completions', h.total_completions
      ) ORDER BY h.completion_date)
      FROM (
        SELECT completion_date,
               SUM(points_earned) as total_points,
               COUNT(*) as total_completions
        FROM task_completions
        WHERE completed_by = p_user_id
          AND completion_date >= v_heatmap_start
        GROUP BY completion_date
      ) h
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- RPC: get_family_analytics
-- Returns family-wide analytics for a parent
CREATE OR REPLACE FUNCTION get_family_analytics(p_family_id uuid, p_weeks integer DEFAULT 12)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_start_date date;
  v_week_start date;
  v_last_week_start date;
  v_caller_family uuid;
  v_caller_role text;
  v_result jsonb;
BEGIN
  SELECT family_id, role INTO v_caller_family, v_caller_role
  FROM profiles WHERE id = auth.uid();

  IF v_caller_family IS DISTINCT FROM p_family_id OR v_caller_role != 'parent' THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  p_weeks := GREATEST(1, LEAST(52, p_weeks));
  v_start_date := current_date - (p_weeks * 7);
  v_week_start := current_date - EXTRACT(DOW FROM current_date)::integer;
  v_last_week_start := v_week_start - 7;

  SELECT jsonb_build_object(
    'children', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'profile', jsonb_build_object(
          'id', p.id,
          'display_name', p.display_name,
          'nickname', p.nickname,
          'avatar_url', p.avatar_url,
          'points', p.points
        ),
        'completions_this_week', COALESCE(cw.cnt, 0),
        'completions_last_week', COALESCE(lw.cnt, 0),
        'completion_rate', CASE
          WHEN COALESCE(eligible.cnt, 0) = 0 THEN 0
          ELSE LEAST(1.0, ROUND(COALESCE(cw.cnt, 0)::numeric / eligible.cnt, 2))
        END
      ))
      FROM profiles p
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as cnt FROM task_completions
        WHERE completed_by = p.id AND completion_date >= v_week_start
      ) cw ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as cnt FROM task_completions
        WHERE completed_by = p.id
          AND completion_date >= v_last_week_start
          AND completion_date < v_week_start
      ) lw ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as cnt FROM tasks
        WHERE family_id = p_family_id
          AND (assigned_to = p.id OR assigned_to IS NULL)
          AND (recurring IS NOT NULL OR completed = false)
      ) eligible ON true
      WHERE p.family_id = p_family_id AND p.role = 'child'
    ), '[]'::jsonb),
    'daily_totals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'date', d.completion_date,
        'points', d.total_points,
        'completions', d.total_completions
      ) ORDER BY d.completion_date)
      FROM (
        SELECT tc.completion_date,
               SUM(tc.points_earned) as total_points,
               COUNT(*) as total_completions
        FROM task_completions tc
        JOIN profiles p ON p.id = tc.completed_by
        WHERE p.family_id = p_family_id
          AND tc.completion_date >= v_start_date
        GROUP BY tc.completion_date
      ) d
    ), '[]'::jsonb),
    'top_tasks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'task_id', tf.task_id,
        'title', tf.title,
        'count', tf.cnt
      ) ORDER BY tf.cnt DESC)
      FROM (
        SELECT tc.task_id, t.title, COUNT(*) as cnt
        FROM task_completions tc
        JOIN tasks t ON t.id = tc.task_id
        JOIN profiles p ON p.id = tc.completed_by
        WHERE p.family_id = p_family_id
          AND tc.completion_date >= v_start_date
        GROUP BY tc.task_id, t.title
        ORDER BY cnt DESC
        LIMIT 10
      ) tf
    ), '[]'::jsonb),
    'bottom_tasks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'task_id', bt.task_id,
        'title', bt.title,
        'count', bt.cnt
      ))
      FROM (
        SELECT
          t.id AS task_id,
          t.title,
          COALESCE(tc_agg.cnt, 0) AS cnt
        FROM tasks t
        LEFT JOIN (
          SELECT tc.task_id, COUNT(*) AS cnt
          FROM task_completions tc
          JOIN profiles p ON p.id = tc.completed_by
          WHERE p.family_id = p_family_id
            AND tc.completion_date >= v_start_date
          GROUP BY tc.task_id
        ) tc_agg ON tc_agg.task_id = t.id
        WHERE t.family_id = p_family_id
          AND t.assigned_to IS NOT NULL
          AND t.created_at < (current_date - INTERVAL '7 days')
        ORDER BY COALESCE(tc_agg.cnt, 0) ASC
        LIMIT 5
      ) bt
    ), '[]'::jsonb),
    'family_completion_rate', COALESCE((
      SELECT ROUND(
        SUM(child_data.completions_this_week)::numeric /
        NULLIF(SUM(child_data.eligible_tasks), 0),
        2
      )
      FROM (
        SELECT
          p.id,
          (
            SELECT COUNT(*) FROM task_completions tc
            WHERE tc.completed_by = p.id
              AND tc.completion_date >= v_week_start
          ) AS completions_this_week,
          (
            SELECT COUNT(*) FROM tasks t
            WHERE t.family_id = p_family_id
              AND (t.assigned_to = p.id OR t.assigned_to IS NULL)
              AND (t.recurring IS NOT NULL OR t.completed = false)
          ) AS eligible_tasks
        FROM profiles p
        WHERE p.family_id = p_family_id AND p.role = 'child'
      ) child_data
    ), 0)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
