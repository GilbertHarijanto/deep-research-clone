-- Create research_sessions table for storing user research history
-- This table will be used with Supabase to persist research sessions

CREATE TABLE IF NOT EXISTS research_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  questions JSONB DEFAULT '[]'::jsonb,
  queries JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'in-progress' CHECK (status IN ('in-progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_research_sessions_user_id ON research_sessions(user_id);

-- Create index on updated_at for sorting
CREATE INDEX IF NOT EXISTS idx_research_sessions_updated_at ON research_sessions(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE research_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only see their own sessions
CREATE POLICY "Users can view their own sessions"
  ON research_sessions
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- Create policy to allow users to insert their own sessions
CREATE POLICY "Users can insert their own sessions"
  ON research_sessions
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Create policy to allow users to update their own sessions
CREATE POLICY "Users can update their own sessions"
  ON research_sessions
  FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Create policy to allow users to delete their own sessions
CREATE POLICY "Users can delete their own sessions"
  ON research_sessions
  FOR DELETE
  USING (auth.uid()::text = user_id);
