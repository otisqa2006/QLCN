-- ==========================================
-- UPDATE v6: Add missing column 'contact_info' to contributors
-- ==========================================

-- Thêm trường thông tin liên hệ cho Cổ đông
ALTER TABLE contributors
ADD COLUMN IF NOT EXISTS contact_info TEXT;

-- (Tùy chọn) Cập nhật lại schema cache để chắc chắn
NOTIFY pgrst, 'reload schema';
