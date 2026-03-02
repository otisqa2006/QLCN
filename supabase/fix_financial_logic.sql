-- Migration: Fix Financial Logic
-- 1. Cập nhật hàm get_financial_summary trả về thêm expense_fund và tách riêng loans, không lấy tổng wallets làm quỹ chi tiêu nữa.
DROP FUNCTION IF EXISTS get_financial_summary(UUID);

CREATE OR REPLACE FUNCTION get_financial_summary(p_user_id UUID)
RETURNS TABLE (
    total_bank DECIMAL(15, 2),
    total_cash DECIMAL(15, 2),
    total_capital DECIMAL(15, 2),
    total_expense_fund DECIMAL(15, 2),
    total_debt DECIMAL(15, 2),
    total_loans DECIMAL(15, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE((SELECT SUM(balance) FROM wallets WHERE user_id = p_user_id AND type = 'BANK'), 0) as total_bank,
        COALESCE((SELECT SUM(balance) FROM wallets WHERE user_id = p_user_id AND type = 'CASH'), 0) as total_cash,
        COALESCE((SELECT SUM(balance) FROM funds WHERE user_id = p_user_id AND type = 'TOTAL_CAPITAL'), 0) as total_capital,
        COALESCE((SELECT SUM(balance) FROM funds WHERE user_id = p_user_id AND type = 'EXPENSE_FUND'), 0) as total_expense_fund,
        COALESCE((SELECT SUM(total_amount - paid_amount) FROM debts WHERE user_id = p_user_id AND status = 'DANG_NO'), 0) as total_debt,
        COALESCE((SELECT SUM(principal_amount) FROM loans WHERE user_id = p_user_id AND status = 'ACTIVE'), 0) as total_loans;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. "Tiền vay là tiền riêng, ko liên quan đến bất kì nhóm tiền nào khác"
-- Xoá bỏ việc cập nhật fund (EXPENSE_FUND) khi vay và trả nợ vay. 
-- Nhưng VẪN giữ việc cộng vào ví thực tế (wallets) vì tiền thật vẫn vào tài khoản/tiền mặt của user.

CREATE OR REPLACE FUNCTION on_loan_insert() RETURNS TRIGGER AS $$
BEGIN
    UPDATE wallets SET balance = balance + NEW.principal_amount WHERE id = NEW.wallet_id;
    -- KHÔNG cập nhật EXPENSE_FUND nữa
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION on_loan_repayment_insert() RETURNS TRIGGER AS $$
BEGIN
    UPDATE wallets SET balance = balance - NEW.amount WHERE id = NEW.wallet_id;
    -- KHÔNG cập nhật EXPENSE_FUND nữa
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
