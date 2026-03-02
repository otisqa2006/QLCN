-- ============================================================
-- QLCN — CLEAR ALL DATA (Giữ nguyên Schema, Policies, Triggers)
-- Last updated: V9 RBAC
-- 
-- ⚠️  CẢNH BÁO: Script này xoá TOÀN BỘ dữ liệu trong database.
--     Cấu trúc bảng, RLS Policies và Triggers vẫn được giữ nguyên.
--     Chỉ chạy khi bạn muốn reset về trạng thái "mới cài".
-- ============================================================

-- Xoá theo thứ tự phụ thuộc (con trước, cha sau) để tránh lỗi FK
TRUNCATE TABLE
    -- Lớp 1: Dữ liệu lá (không bảng nào phụ thuộc vào đây)
    log_materials,
    farm_logs,
    ai_chat_history,
    salary_advances_payments,
    timesheets,
    inventory_transactions,
    debt_payments,
    loan_repayments,
    contributions,
    fund_transfers,
    harvest_batches,
    -- Lớp 2: Dữ liệu trực tiếp
    debts,
    expenses,
    plots,
    workers,
    inventory_items,
    suppliers,
    expense_categories,
    harvest_seasons,
    loans,
    contributors,
    -- Lớp 3: Farm & Members (xoá members trước, farm sau)
    farm_members,
    farms,
    -- Lớp 4: Tài chính gốc (wallets, funds)
    funds,
    wallets,
    -- Lớp 5: Profiles (giữ lại auth.users, chỉ xoá dữ liệu app)
    profiles
RESTART IDENTITY CASCADE;

-- ============================================================
-- SAU KHI XOÁ: Tái tạo Wallets, Funds và Profile cho user hiện tại
-- (Vì trigger `handle_new_user_wallets` chỉ chạy khi user MỚI đăng ký,
--  không chạy lại sau khi truncate.)
-- ============================================================
INSERT INTO public.wallets (user_id, type)
SELECT id, 'BANK' FROM auth.users
ON CONFLICT (user_id, type) DO NOTHING;

INSERT INTO public.wallets (user_id, type)
SELECT id, 'CASH' FROM auth.users
ON CONFLICT (user_id, type) DO NOTHING;

INSERT INTO public.funds (user_id, type)
SELECT id, 'TOTAL_CAPITAL' FROM auth.users
ON CONFLICT (user_id, type) DO NOTHING;

INSERT INTO public.funds (user_id, type)
SELECT id, 'EXPENSE_FUND' FROM auth.users
ON CONFLICT (user_id, type) DO NOTHING;

-- Tái tạo Profiles cho tất cả user hiện có
INSERT INTO public.profiles (id, email, full_name, is_admin)
SELECT
    id,
    email,
    COALESCE(raw_user_meta_data->>'full_name', ''),
    CASE WHEN email = 'betokutin@gmail.com' THEN true ELSE false END
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ✅ Hoàn tất. Database đã được reset về trạng thái sạch.
--    Wallets, Funds và Profiles đã được tái tạo cho tất cả users.
-- ============================================================
