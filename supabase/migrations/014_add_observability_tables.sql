-- Observability tables: app_errors, app_events, admin_auth_attempts
-- Plus RPCs for dashboard data and cleanup

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS app_errors (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  error_message text        NOT NULL,
  error_type    text        NOT NULL CHECK (error_type IN ('rpc', 'api', 'client', 'boundary', 'middleware')),
  error_code    text,
  route         text        NOT NULL,
  method        text,
  user_id       uuid,       -- no FK: logging must never fail due to referential violations
  metadata      jsonb       DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_errors_created_at ON app_errors (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_errors_route ON app_errors (route);
CREATE INDEX IF NOT EXISTS idx_app_errors_error_type ON app_errors (error_type);

ALTER TABLE app_errors ENABLE ROW LEVEL SECURITY;
-- No RLS policies = only service_role can access

-- ============================================================

CREATE TABLE IF NOT EXISTS app_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text        NOT NULL,  -- validated at app layer, no CHECK constraint
  user_id     uuid,                  -- no FK
  family_id   uuid,                  -- no FK
  metadata    jsonb       DEFAULT '{}'::jsonb,
  duration_ms integer,               -- dedicated column for performance queries
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_events_created_at ON app_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_event_type ON app_events (event_type);
CREATE INDEX IF NOT EXISTS idx_app_events_user_id ON app_events (user_id);
CREATE INDEX IF NOT EXISTS idx_app_events_type_created ON app_events (event_type, created_at DESC);

-- Expression indexes for performance queries on JSONB paths
CREATE INDEX IF NOT EXISTS idx_app_events_api_route
  ON app_events ((metadata->>'route'))
  WHERE event_type = 'api_request';

CREATE INDEX IF NOT EXISTS idx_app_events_rpc_name
  ON app_events ((metadata->>'rpcName'))
  WHERE event_type = 'rpc_call';

ALTER TABLE app_events ENABLE ROW LEVEL SECURITY;
-- No RLS policies = only service_role can access

-- ============================================================

CREATE TABLE IF NOT EXISTS admin_auth_attempts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash      text        NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_auth_attempts_ip_recent
  ON admin_auth_attempts (ip_hash, attempted_at DESC);

ALTER TABLE admin_auth_attempts ENABLE ROW LEVEL SECURITY;
-- No RLS policies = only service_role can access

-- ============================================================
-- RPC: get_observability_summary
-- ============================================================

CREATE OR REPLACE FUNCTION get_observability_summary(p_range_hours integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_since timestamptz := now() - (p_range_hours || ' hours')::interval;
  v_prev_since timestamptz := now() - (p_range_hours * 2 || ' hours')::interval;
  v_error_count integer;
  v_prev_error_count integer;
  v_active_users integer;
  v_avg_latency_ms numeric;
  v_error_rate_trend jsonb;
  v_top_errors jsonb;
  v_route_latency jsonb;
BEGIN
  -- Error count
  SELECT COUNT(*) INTO v_error_count
  FROM app_errors WHERE created_at >= v_since;

  -- Previous period error count (for trend)
  SELECT COUNT(*) INTO v_prev_error_count
  FROM app_errors WHERE created_at >= v_prev_since AND created_at < v_since;

  -- Active users (distinct users who triggered events)
  SELECT COUNT(DISTINCT user_id) INTO v_active_users
  FROM app_events
  WHERE created_at >= v_since AND user_id IS NOT NULL;

  -- Average API latency
  SELECT COALESCE(ROUND(AVG(duration_ms)), 0) INTO v_avg_latency_ms
  FROM app_events
  WHERE event_type = 'api_request' AND created_at >= v_since AND duration_ms IS NOT NULL;

  -- Hourly error rate trend (capped at 720 = 30 days of hours)
  SELECT COALESCE(jsonb_agg(bucket ORDER BY bucket_time), '[]'::jsonb)
  INTO v_error_rate_trend
  FROM (
    SELECT
      to_char(date_trunc('hour', created_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS bucket_time,
      jsonb_build_object(
        'time', to_char(date_trunc('hour', created_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'count', COUNT(*)
      ) AS bucket
    FROM app_errors
    WHERE created_at >= v_since
    GROUP BY date_trunc('hour', created_at)
    ORDER BY date_trunc('hour', created_at) DESC
    LIMIT 720
  ) sub;

  -- Top errors by message
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
  INTO v_top_errors
  FROM (
    SELECT jsonb_build_object(
      'error_message', error_message,
      'route', route,
      'count', COUNT(*)
    ) AS row
    FROM app_errors
    WHERE created_at >= v_since
    GROUP BY error_message, route
    ORDER BY COUNT(*) DESC
    LIMIT 5
  ) sub;

  -- Route latency (p95)
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
  INTO v_route_latency
  FROM (
    SELECT jsonb_build_object(
      'route', metadata->>'route',
      'p95_ms', ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)),
      'avg_ms', ROUND(AVG(duration_ms)),
      'count', COUNT(*)
    ) AS row
    FROM app_events
    WHERE event_type = 'api_request'
      AND created_at >= v_since
      AND duration_ms IS NOT NULL
      AND metadata->>'route' IS NOT NULL
    GROUP BY metadata->>'route'
    ORDER BY COUNT(*) DESC
    LIMIT 10
  ) sub;

  RETURN jsonb_build_object(
    'error_count', v_error_count,
    'prev_error_count', v_prev_error_count,
    'active_users', v_active_users,
    'avg_latency_ms', v_avg_latency_ms,
    'error_rate_trend', v_error_rate_trend,
    'top_errors', v_top_errors,
    'route_latency', v_route_latency
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION get_observability_summary(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_observability_summary(integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_observability_summary(integer) FROM anon;

-- ============================================================
-- RPC: get_recent_errors
-- ============================================================

CREATE OR REPLACE FUNCTION get_recent_errors(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_type text DEFAULT NULL,
  p_range_hours integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_since timestamptz := now() - (p_range_hours || ' hours')::interval;
  v_errors jsonb;
  v_total integer;
  v_total_pages integer;
BEGIN
  -- Total count
  SELECT COUNT(*) INTO v_total
  FROM app_errors
  WHERE created_at >= v_since
    AND (p_type IS NULL OR error_type = p_type);

  v_total_pages := CEIL(v_total::numeric / GREATEST(p_limit, 1));

  -- Paginated errors
  SELECT COALESCE(jsonb_agg(row ORDER BY created_at_ts DESC), '[]'::jsonb)
  INTO v_errors
  FROM (
    SELECT
      jsonb_build_object(
        'id', id,
        'error_message', error_message,
        'error_type', error_type,
        'error_code', error_code,
        'route', route,
        'method', method,
        'user_id', user_id,
        'metadata', metadata,
        'created_at', to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      ) AS row,
      created_at AS created_at_ts
    FROM app_errors
    WHERE created_at >= v_since
      AND (p_type IS NULL OR error_type = p_type)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object(
    'errors', v_errors,
    'total', v_total,
    'page', (p_offset / GREATEST(p_limit, 1)) + 1,
    'total_pages', v_total_pages
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION get_recent_errors(integer, integer, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_recent_errors(integer, integer, text, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_recent_errors(integer, integer, text, integer) FROM anon;

-- ============================================================
-- RPC: get_performance_metrics
-- ============================================================

CREATE OR REPLACE FUNCTION get_performance_metrics(p_range_hours integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_since timestamptz := now() - (p_range_hours || ' hours')::interval;
  v_route_latency jsonb;
  v_rpc_timing jsonb;
  v_latency_trend jsonb;
BEGIN
  -- Route latency (p95 per API route)
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
  INTO v_route_latency
  FROM (
    SELECT jsonb_build_object(
      'route', metadata->>'route',
      'p95_ms', ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)),
      'avg_ms', ROUND(AVG(duration_ms)),
      'min_ms', MIN(duration_ms),
      'max_ms', MAX(duration_ms),
      'count', COUNT(*)
    ) AS row
    FROM app_events
    WHERE event_type = 'api_request'
      AND created_at >= v_since
      AND duration_ms IS NOT NULL
      AND metadata->>'route' IS NOT NULL
    GROUP BY metadata->>'route'
    ORDER BY COUNT(*) DESC
    LIMIT 20
  ) sub;

  -- RPC timing (p95 per RPC name)
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
  INTO v_rpc_timing
  FROM (
    SELECT jsonb_build_object(
      'rpc_name', metadata->>'rpcName',
      'p95_ms', ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)),
      'avg_ms', ROUND(AVG(duration_ms)),
      'min_ms', MIN(duration_ms),
      'max_ms', MAX(duration_ms),
      'count', COUNT(*)
    ) AS row
    FROM app_events
    WHERE event_type = 'rpc_call'
      AND created_at >= v_since
      AND duration_ms IS NOT NULL
      AND metadata->>'rpcName' IS NOT NULL
    GROUP BY metadata->>'rpcName'
    ORDER BY COUNT(*) DESC
    LIMIT 20
  ) sub;

  -- Hourly avg latency trend (capped at 720)
  SELECT COALESCE(jsonb_agg(bucket ORDER BY bucket_time), '[]'::jsonb)
  INTO v_latency_trend
  FROM (
    SELECT
      to_char(date_trunc('hour', created_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS bucket_time,
      jsonb_build_object(
        'time', to_char(date_trunc('hour', created_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'avg_ms', ROUND(AVG(duration_ms))
      ) AS bucket
    FROM app_events
    WHERE event_type = 'api_request'
      AND created_at >= v_since
      AND duration_ms IS NOT NULL
    GROUP BY date_trunc('hour', created_at)
    ORDER BY date_trunc('hour', created_at) ASC
    LIMIT 720
  ) sub;

  RETURN jsonb_build_object(
    'route_latency', v_route_latency,
    'rpc_timing', v_rpc_timing,
    'latency_trend', v_latency_trend
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION get_performance_metrics(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_performance_metrics(integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_performance_metrics(integer) FROM anon;

-- ============================================================
-- RPC: get_usage_analytics
-- ============================================================

CREATE OR REPLACE FUNCTION get_usage_analytics(p_range_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_since timestamptz := now() - (p_range_days || ' days')::interval;
  v_daily_active_users jsonb;
  v_top_chores jsonb;
  v_least_chores jsonb;
  v_peak_hours jsonb;
  v_ai_call_volume jsonb;
  v_event_counts jsonb;
BEGIN
  -- Daily active users
  SELECT COALESCE(jsonb_agg(row ORDER BY day ASC), '[]'::jsonb)
  INTO v_daily_active_users
  FROM (
    SELECT jsonb_build_object(
      'date', to_char(date_trunc('day', created_at), 'YYYY-MM-DD'),
      'users', COUNT(DISTINCT user_id)
    ) AS row,
    date_trunc('day', created_at) AS day
    FROM app_events
    WHERE created_at >= v_since AND user_id IS NOT NULL
    GROUP BY date_trunc('day', created_at)
  ) sub;

  -- Top 5 most completed chores (task_completed events, task name in metadata->>'taskName')
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
  INTO v_top_chores
  FROM (
    SELECT jsonb_build_object(
      'task_name', metadata->>'taskName',
      'count', COUNT(*)
    ) AS row
    FROM app_events
    WHERE event_type = 'task_completed'
      AND created_at >= v_since
      AND metadata->>'taskName' IS NOT NULL
    GROUP BY metadata->>'taskName'
    ORDER BY COUNT(*) DESC
    LIMIT 5
  ) sub;

  -- Least completed (5 least, excluding zero-completion tasks which are invisible)
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
  INTO v_least_chores
  FROM (
    SELECT jsonb_build_object(
      'task_name', metadata->>'taskName',
      'count', COUNT(*)
    ) AS row
    FROM app_events
    WHERE event_type = 'task_completed'
      AND created_at >= v_since
      AND metadata->>'taskName' IS NOT NULL
    GROUP BY metadata->>'taskName'
    ORDER BY COUNT(*) ASC
    LIMIT 5
  ) sub;

  -- Peak hours (UTC hour 0-23)
  SELECT COALESCE(jsonb_agg(row ORDER BY hour ASC), '[]'::jsonb)
  INTO v_peak_hours
  FROM (
    SELECT jsonb_build_object(
      'hour', EXTRACT(HOUR FROM created_at)::integer,
      'count', COUNT(*)
    ) AS row,
    EXTRACT(HOUR FROM created_at)::integer AS hour
    FROM app_events
    WHERE created_at >= v_since
    GROUP BY EXTRACT(HOUR FROM created_at)::integer
  ) sub;

  -- AI call volume by day
  SELECT COALESCE(jsonb_agg(row ORDER BY day ASC), '[]'::jsonb)
  INTO v_ai_call_volume
  FROM (
    SELECT jsonb_build_object(
      'date', to_char(date_trunc('day', created_at), 'YYYY-MM-DD'),
      'count', COUNT(*)
    ) AS row,
    date_trunc('day', created_at) AS day
    FROM app_events
    WHERE event_type IN ('ai_insight_generated', 'ai_encouragement_generated', 'ai_quest_parsed')
      AND created_at >= v_since
    GROUP BY date_trunc('day', created_at)
  ) sub;

  -- Event counts by type
  SELECT COALESCE(
    jsonb_object_agg(event_type, cnt),
    '{}'::jsonb
  ) INTO v_event_counts
  FROM (
    SELECT event_type, COUNT(*) AS cnt
    FROM app_events
    WHERE created_at >= v_since
    GROUP BY event_type
  ) sub;

  RETURN jsonb_build_object(
    'daily_active_users', v_daily_active_users,
    'top_chores', v_top_chores,
    'least_chores', v_least_chores,
    'peak_hours', v_peak_hours,
    'ai_call_volume', v_ai_call_volume,
    'event_counts', v_event_counts
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION get_usage_analytics(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_usage_analytics(integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_usage_analytics(integer) FROM anon;

-- ============================================================
-- RPC: cleanup_old_observability_data
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_old_observability_data(p_days integer DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff timestamptz := now() - (p_days || ' days')::interval;
  v_errors_deleted integer;
  v_events_deleted integer;
BEGIN
  DELETE FROM app_errors WHERE created_at < v_cutoff;
  GET DIAGNOSTICS v_errors_deleted = ROW_COUNT;

  DELETE FROM app_events WHERE created_at < v_cutoff;
  GET DIAGNOSTICS v_events_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'errors_deleted', v_errors_deleted,
    'events_deleted', v_events_deleted,
    'cutoff', to_char(v_cutoff, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION cleanup_old_observability_data(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION cleanup_old_observability_data(integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION cleanup_old_observability_data(integer) FROM anon;
