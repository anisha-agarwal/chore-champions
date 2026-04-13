-- ============================================================
-- 017: Push Notifications — subscriptions + preferences
-- ============================================================

-- Notification type enum — single source of truth shared by app + DB.
-- Add new values with ALTER TYPE in a follow-up migration.
CREATE TYPE notification_type AS ENUM (
  'task_completed',
  'streak_milestone',
  'test'
);

-- ============================================================
-- push_subscriptions — one row per (user, device/browser)
-- ============================================================
CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh_key text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_subscriptions" ON push_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_subscriptions" ON push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_delete_own_subscriptions" ON push_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- No UPDATE: subscriptions are immutable. Re-subscribing inserts a new row
-- (or hits the UNIQUE constraint and is a no-op at the app layer).

-- ============================================================
-- notification_preferences — one row per user
-- ============================================================
CREATE TABLE notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT true,
  types_enabled jsonb NOT NULL DEFAULT
    '{"task_completed":true,"streak_milestone":true,"test":true}'::jsonb,
  quiet_hours_start smallint CHECK (quiet_hours_start IS NULL OR (quiet_hours_start BETWEEN 0 AND 23)),
  quiet_hours_end smallint CHECK (quiet_hours_end IS NULL OR (quiet_hours_end BETWEEN 0 AND 23)),
  timezone text NOT NULL DEFAULT 'UTC',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_preferences" ON notification_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_preferences" ON notification_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_preferences" ON notification_preferences
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_delete_own_preferences" ON notification_preferences
  FOR DELETE USING (user_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_notification_preferences_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION set_notification_preferences_updated_at();
