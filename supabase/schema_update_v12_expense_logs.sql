-- =====================================================
-- V12: Expense Activity Logs
-- =====================================================

CREATE TABLE IF NOT EXISTS expense_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    farm_id     UUID REFERENCES farms(id) ON DELETE CASCADE,
    season_id   UUID REFERENCES harvest_seasons(id) ON DELETE SET NULL,
    expense_id  UUID,                        -- NULL when deleted
    action      TEXT NOT NULL,               -- 'CREATE' | 'UPDATE' | 'DELETE'
    amount      NUMERIC,
    category    TEXT,
    description TEXT,
    meta        JSONB,                       -- extra diff info for UPDATE
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_expense_logs_farm_season ON expense_logs(farm_id, season_id);
CREATE INDEX IF NOT EXISTS idx_expense_logs_user ON expense_logs(user_id);

-- RLS
ALTER TABLE expense_logs ENABLE ROW LEVEL SECURITY;

-- Members can only see logs for their farm
CREATE POLICY "expense_logs_select" ON expense_logs
    FOR SELECT USING (auth_is_farm_member(farm_id));

-- Anyone who can write expenses can write logs (insert only)
CREATE POLICY "expense_logs_insert" ON expense_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);
