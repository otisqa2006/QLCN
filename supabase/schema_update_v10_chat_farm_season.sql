-- ============================================================
-- QLCN V10: Add farm_id & season_id to ai_chat_history
-- Mục đích: Lịch sử chat AI được phân tách theo Khu Vườn và Mùa Vụ
-- ============================================================

-- 1. Thêm cột farm_id và season_id (nullable để tương thích dữ liệu cũ)
ALTER TABLE public.ai_chat_history
    ADD COLUMN IF NOT EXISTS farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES public.harvest_seasons(id) ON DELETE CASCADE;

-- 2. Index để query nhanh theo farm + season
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_farm_season
    ON public.ai_chat_history(user_id, farm_id, season_id, created_at DESC);

-- 3. Xoá index cũ (nếu có) và thay bằng index tổng hợp
DROP INDEX IF EXISTS idx_ai_chat_history_user_created;
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_user_created
    ON public.ai_chat_history(user_id, created_at DESC);

-- ============================================================
-- ✅ Hoàn tất. Chạy script này một lần duy nhất trong Supabase.
--    Dữ liệu cũ (farm_id/season_id = NULL) vẫn được giữ nguyên.
-- ============================================================
