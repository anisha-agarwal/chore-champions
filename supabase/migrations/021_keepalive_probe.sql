-- ============================================================
-- 021: Keep-alive probe table + RPC
-- ============================================================
-- Supabase auto-pauses free-tier projects after ~7 days of inactivity.
-- A read-only RPC ping (used previously) does not reliably register as
-- activity, so we use a dedicated singleton table that the keep-alive
-- workflow updates via an RPC. The UPDATE is a real DB write and is
-- guaranteed to count.

CREATE TABLE IF NOT EXISTS keepalive_pings (
  id int PRIMARY KEY DEFAULT 1,
  last_ping_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT keepalive_pings_singleton CHECK (id = 1)
);

INSERT INTO keepalive_pings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS enabled with no policies; only service_role / SECURITY DEFINER
-- functions may read or write the table.
ALTER TABLE keepalive_pings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION keepalive_ping()
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE keepalive_pings
  SET last_ping_at = now()
  WHERE id = 1
  RETURNING last_ping_at;
$$;

-- Anon may invoke this RPC; the function itself runs as the owner and
-- mutates only the singleton row.
GRANT EXECUTE ON FUNCTION keepalive_ping() TO anon, authenticated;
