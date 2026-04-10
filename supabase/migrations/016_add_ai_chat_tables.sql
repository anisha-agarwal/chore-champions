-- ============================================================
-- Parent assistant conversations
-- ============================================================
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_conversations_family_updated
  ON ai_conversations (family_id, updated_at DESC);
CREATE INDEX idx_ai_conversations_parent
  ON ai_conversations (parent_id);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parents_select_conversations" ON ai_conversations
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
  );

CREATE POLICY "parents_insert_conversations" ON ai_conversations
  FOR INSERT WITH CHECK (
    parent_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
  );

CREATE POLICY "parents_update_conversations" ON ai_conversations
  FOR UPDATE USING (parent_id = auth.uid());

-- ============================================================
-- Kid chat conversations
-- ============================================================
CREATE TABLE ai_kid_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_kid_chats_child_created
  ON ai_kid_chats (child_id, created_at DESC);
CREATE INDEX idx_ai_kid_chats_family_created
  ON ai_kid_chats (family_id, created_at DESC);

ALTER TABLE ai_kid_chats ENABLE ROW LEVEL SECURITY;

-- Kids: SELECT, INSERT, UPDATE only — NO DELETE (append-only)
CREATE POLICY "kids_select_own_chats" ON ai_kid_chats
  FOR SELECT USING (child_id = auth.uid());

CREATE POLICY "kids_insert_own_chats" ON ai_kid_chats
  FOR INSERT WITH CHECK (child_id = auth.uid());

CREATE POLICY "kids_update_own_chats" ON ai_kid_chats
  FOR UPDATE USING (child_id = auth.uid());

-- Parents can view their family's kid chats (read-only)
CREATE POLICY "parents_view_kid_chats" ON ai_kid_chats
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
  );

-- ============================================================
-- Rate limiting — dual cap (per-family + per-user)
-- ============================================================
CREATE TABLE ai_daily_usage (
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (family_id, user_id, usage_date)
);

CREATE INDEX idx_ai_daily_usage_family_date
  ON ai_daily_usage (family_id, usage_date);

ALTER TABLE ai_daily_usage ENABLE ROW LEVEL SECURITY;

-- Parents can view family usage (for potential UI display)
CREATE POLICY "parents_view_usage" ON ai_daily_usage
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
  );

-- ============================================================
-- Helper functions (SECURITY DEFINER — called by API routes)
-- ============================================================

-- Atomic rate limit check + increment with dual caps
CREATE OR REPLACE FUNCTION check_and_increment_ai_rate_limit(
  p_family_id UUID,
  p_user_id UUID,
  p_family_limit INT DEFAULT 50,
  p_user_limit INT DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_count INT;
  v_family_count INT;
BEGIN
  -- Upsert per-user row and increment
  INSERT INTO ai_daily_usage (family_id, user_id, usage_date, message_count)
  VALUES (p_family_id, p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (family_id, user_id, usage_date)
  DO UPDATE SET message_count = ai_daily_usage.message_count + 1
  RETURNING message_count INTO v_user_count;

  -- Check per-user cap
  IF v_user_count > p_user_limit THEN
    UPDATE ai_daily_usage
    SET message_count = message_count - 1
    WHERE family_id = p_family_id AND user_id = p_user_id AND usage_date = CURRENT_DATE;
    RETURN jsonb_build_object('allowed', false, 'reason', 'user_limit');
  END IF;

  -- Check family total
  SELECT COALESCE(SUM(message_count), 0) INTO v_family_count
  FROM ai_daily_usage
  WHERE family_id = p_family_id AND usage_date = CURRENT_DATE;

  IF v_family_count > p_family_limit THEN
    UPDATE ai_daily_usage
    SET message_count = message_count - 1
    WHERE family_id = p_family_id AND user_id = p_user_id AND usage_date = CURRENT_DATE;
    RETURN jsonb_build_object('allowed', false, 'reason', 'family_limit');
  END IF;

  RETURN jsonb_build_object('allowed', true, 'reason', null);
END;
$$;

-- Atomic append messages to parent conversation
CREATE OR REPLACE FUNCTION append_chat_messages(p_id UUID, p_messages JSONB)
RETURNS void AS $$
  UPDATE ai_conversations
  SET messages = messages || p_messages,
      updated_at = now()
  WHERE id = p_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Atomic append messages to kid chat
CREATE OR REPLACE FUNCTION append_kid_chat_messages(p_id UUID, p_messages JSONB)
RETURNS void AS $$
  UPDATE ai_kid_chats
  SET messages = messages || p_messages
  WHERE id = p_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ai_conversations_updated_at
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
