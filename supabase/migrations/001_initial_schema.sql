-- Chore Champions Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Families (household groups)
CREATE TABLE families (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  invite_code text UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_at timestamp with time zone DEFAULT now()
);

-- Family members (profiles linked to auth)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  family_id uuid REFERENCES families ON DELETE SET NULL,
  display_name text NOT NULL,
  avatar_url text,
  nickname text,  -- fun name like "Panther", "Baby Bison"
  role text DEFAULT 'child' CHECK (role IN ('parent', 'child')),
  points integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Tasks/Quests
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid REFERENCES families ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES profiles ON DELETE SET NULL,
  points integer DEFAULT 10,
  time_of_day text DEFAULT 'anytime' CHECK (time_of_day IN ('morning', 'afternoon', 'night', 'anytime')),
  recurring text CHECK (recurring IN ('daily', 'weekly') OR recurring IS NULL),
  due_date date,
  completed boolean DEFAULT false,
  created_by uuid REFERENCES profiles ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Task completions (history)
CREATE TABLE task_completions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id uuid REFERENCES tasks ON DELETE CASCADE NOT NULL,
  completed_by uuid REFERENCES profiles ON DELETE SET NULL,
  completed_at timestamp with time zone DEFAULT now(),
  points_earned integer NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX idx_profiles_family_id ON profiles(family_id);
CREATE INDEX idx_tasks_family_id ON tasks(family_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_task_completions_task_id ON task_completions(task_id);
CREATE INDEX idx_task_completions_completed_by ON task_completions(completed_by);

-- Enable Row Level Security (RLS)
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for families
CREATE POLICY "Users can view their own family"
  ON families FOR SELECT
  USING (id IN (SELECT family_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create families"
  ON families FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Family parents can update family"
  ON families FOR UPDATE
  USING (id IN (SELECT family_id FROM profiles WHERE id = auth.uid() AND role = 'parent'));

-- RLS Policies for profiles
CREATE POLICY "Users can view profiles in their family"
  ON profiles FOR SELECT
  USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
    OR id = auth.uid()
  );

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- RLS Policies for tasks
CREATE POLICY "Users can view tasks in their family"
  ON tasks FOR SELECT
  USING (family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Family members can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Family members can update tasks"
  ON tasks FOR UPDATE
  USING (family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Family parents can delete tasks"
  ON tasks FOR DELETE
  USING (family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid() AND role = 'parent'));

-- RLS Policies for task_completions
CREATE POLICY "Users can view completions in their family"
  ON task_completions FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Family members can create completions"
  ON task_completions FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT id FROM tasks
      WHERE family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to award points when task is completed
CREATE OR REPLACE FUNCTION award_points_on_completion()
RETURNS trigger AS $$
BEGIN
  UPDATE profiles
  SET points = points + NEW.points_earned
  WHERE id = NEW.completed_by;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to award points
CREATE OR REPLACE TRIGGER on_task_completed
  AFTER INSERT ON task_completions
  FOR EACH ROW EXECUTE FUNCTION award_points_on_completion();

-- Function to get family by invite code (for joining)
CREATE OR REPLACE FUNCTION get_family_by_invite_code(code text)
RETURNS TABLE (id uuid, name text) AS $$
BEGIN
  RETURN QUERY SELECT families.id, families.name FROM families WHERE invite_code = code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
