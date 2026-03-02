-- ==========================================
-- QLCN Sprint 7: AI Chat History Schema
-- ==========================================

-- 1. Create AI Chat History Table
CREATE TABLE IF NOT EXISTS ai_chat_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'bot')),
    content TEXT NOT NULL,
    expenses_json JSONB, -- Optional: Store parsed expenses if the bot successfully parsed them
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable RLS
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;

-- 3. Setup Policies
CREATE POLICY "Users can view own ai_chat_history" ON ai_chat_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai_chat_history" ON ai_chat_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own ai_chat_history" ON ai_chat_history FOR DELETE USING (auth.uid() = user_id);
-- Update isn't typically needed for chat logs, but adding for completeness
CREATE POLICY "Users can update own ai_chat_history" ON ai_chat_history FOR UPDATE USING (auth.uid() = user_id);

-- Optional: Create an index for faster ordering and pagination by created_at and user
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_user_created ON ai_chat_history(user_id, created_at DESC);
