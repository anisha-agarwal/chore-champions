-- ============================================================
-- 015: Rewards Store Tables, RLS, RPCs
-- ============================================================

-- rewards table
CREATE TABLE rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) <= 200),
  description text,
  points_cost integer NOT NULL CHECK (points_cost >= 1),
  icon_id text NOT NULL DEFAULT 'star',
  category text NOT NULL DEFAULT 'other',
  stock integer CHECK (stock IS NULL OR stock >= 1),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- reward_redemptions table
CREATE TABLE reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id uuid NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
  redeemed_by uuid NOT NULL REFERENCES profiles(id),
  points_cost integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id)
);

-- Indexes
CREATE INDEX idx_rewards_family_active ON rewards(family_id, active) WHERE active = true;
CREATE INDEX idx_rewards_family_id ON rewards(family_id);
CREATE INDEX idx_redemptions_redeemed_by_status ON reward_redemptions(redeemed_by, status);
CREATE INDEX idx_redemptions_status ON reward_redemptions(status) WHERE status = 'pending';
CREATE INDEX idx_redemptions_reward_id ON reward_redemptions(reward_id);

-- updated_at trigger for rewards
CREATE OR REPLACE FUNCTION set_rewards_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER rewards_updated_at
  BEFORE UPDATE ON rewards
  FOR EACH ROW EXECUTE FUNCTION set_rewards_updated_at();

-- ============================================================
-- RLS: rewards
-- ============================================================
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family_members_select_rewards" ON rewards FOR SELECT
  USING (family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "parents_insert_rewards" ON rewards FOR INSERT
  WITH CHECK (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'parent'
  );

CREATE POLICY "parents_update_rewards" ON rewards FOR UPDATE
  USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'parent'
  );

-- No DELETE: rewards are deactivated, not deleted. Preserves redemption history.
-- Explicit deny makes intent clear (not a forgotten policy).
CREATE POLICY "no_delete_rewards" ON rewards FOR DELETE USING (false);

-- ============================================================
-- RLS: reward_redemptions
-- ============================================================
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;

-- Users see their own redemptions; parents see all family redemptions
CREATE POLICY "own_or_family_parent_select_redemptions" ON reward_redemptions FOR SELECT
  USING (
    redeemed_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN rewards r ON r.family_id = p.family_id
      WHERE p.id = auth.uid() AND p.role = 'parent' AND r.id = reward_redemptions.reward_id
    )
  );

-- No direct INSERT/UPDATE/DELETE — handled by SECURITY DEFINER RPCs
CREATE POLICY "no_insert_redemptions" ON reward_redemptions FOR INSERT WITH CHECK (false);
CREATE POLICY "no_update_redemptions" ON reward_redemptions FOR UPDATE USING (false);
CREATE POLICY "no_delete_redemptions" ON reward_redemptions FOR DELETE USING (false);

-- ============================================================
-- RPC: redeem_reward
-- ============================================================
CREATE OR REPLACE FUNCTION redeem_reward(p_user_id uuid, p_reward_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reward rewards%ROWTYPE;
  v_rows_affected int;
  v_cost int;
BEGIN
  -- Auth: caller must be the authenticated user
  IF p_user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Fetch reward
  SELECT * INTO v_reward FROM rewards WHERE id = p_reward_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward not found');
  END IF;

  IF NOT v_reward.active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward is no longer available');
  END IF;

  -- Auth: must be a child in the same family as the reward
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND family_id = v_reward.family_id AND role = 'child'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  v_cost := v_reward.points_cost;

  -- Check and decrement stock atomically (if limited)
  IF v_reward.stock IS NOT NULL THEN
    UPDATE rewards SET stock = stock - 1
    WHERE id = p_reward_id AND stock > 0;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Out of stock');
    END IF;
  END IF;

  -- Atomic point deduction (only succeeds if user has enough)
  UPDATE profiles SET points = points - v_cost
  WHERE id = p_user_id AND points >= v_cost;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  IF v_rows_affected = 0 THEN
    -- Explicit rollback: undo stock decrement
    -- NOTE: A normal RETURN does NOT rollback prior writes in PL/pgSQL.
    -- Only RAISE EXCEPTION triggers automatic rollback. We must undo manually.
    IF v_reward.stock IS NOT NULL THEN
      UPDATE rewards SET stock = stock + 1 WHERE id = p_reward_id;
    END IF;
    RETURN jsonb_build_object('success', false, 'error',
      'Not enough points (need ' || v_cost || ')');
  END IF;

  -- Create redemption record with cost snapshot
  INSERT INTO reward_redemptions (reward_id, redeemed_by, status, points_cost)
  VALUES (p_reward_id, p_user_id, 'pending', v_cost);

  RETURN jsonb_build_object('success', true, 'points_spent', v_cost);

EXCEPTION WHEN OTHERS THEN
  -- Unhandled exception: PG auto-rolls back all writes in this transaction.
  -- Return structured error to honour the client contract.
  RETURN jsonb_build_object('success', false, 'error', 'Unexpected error. Please try again.');
END;
$$;

-- ============================================================
-- RPC: resolve_redemption (approve or reject)
-- ============================================================
CREATE OR REPLACE FUNCTION resolve_redemption(
  p_user_id uuid,
  p_redemption_id uuid,
  p_action text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_redemption reward_redemptions%ROWTYPE;
  v_reward rewards%ROWTYPE;
  v_rows_affected int;
BEGIN
  -- Auth: caller must be the authenticated user
  IF p_user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Validate action
  IF p_action NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;

  -- Fetch redemption
  SELECT * INTO v_redemption FROM reward_redemptions WHERE id = p_redemption_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Redemption not found');
  END IF;

  IF v_redemption.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already resolved');
  END IF;

  -- Fetch reward for family check
  SELECT * INTO v_reward FROM rewards WHERE id = v_redemption.reward_id;

  -- Auth: must be parent in same family
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND family_id = v_reward.family_id AND role = 'parent'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Update redemption status (WHERE status = 'pending' prevents double-resolution)
  UPDATE reward_redemptions
  SET status = p_action, resolved_at = now(), resolved_by = p_user_id
  WHERE id = p_redemption_id AND status = 'pending';

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already resolved');
  END IF;

  -- On rejection: refund points (using snapshot cost) and restore stock
  IF p_action = 'rejected' THEN
    UPDATE profiles SET points = points + v_redemption.points_cost
    WHERE id = v_redemption.redeemed_by;

    IF v_reward.stock IS NOT NULL THEN
      UPDATE rewards SET stock = stock + 1 WHERE id = v_reward.id;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'Unexpected error. Please try again.');
END;
$$;
