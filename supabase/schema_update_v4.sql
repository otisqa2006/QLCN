-- ==========================================
-- QLCN Sprint 7: Cashflow Redesign (V4)
-- ==========================================
-- This update separates TOTAL_CAPITAL and EXPENSE_FUND.
-- Contributions and Harvests will NO LONGER increment wallets (CASH/BANK).
-- They only increment TOTAL_CAPITAL. Wallets are strictly for operating expenses.

-- 1. Update Contribution Trigger
CREATE OR REPLACE FUNCTION on_contribution_insert() RETURNS TRIGGER AS $$
BEGIN
    -- No longer updating wallets directly
    UPDATE funds SET balance = balance + NEW.amount WHERE user_id = NEW.user_id AND type = 'TOTAL_CAPITAL';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Update Harvest Trigger
CREATE OR REPLACE FUNCTION on_harvest_insert() RETURNS TRIGGER AS $$
BEGIN
    -- No longer updating wallets directly
    UPDATE funds SET balance = balance + NEW.total_revenue WHERE user_id = NEW.user_id AND type = 'TOTAL_CAPITAL';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Data Recalculation (Migrate existing data to new logic)
DO $$
DECLARE
    u RECORD;
    w RECORD;
    f_cap UUID;
    f_exp UUID;
BEGIN
    FOR u IN (SELECT id FROM auth.users) LOOP
        -- A. Reset all balances to 0 for a clean state
        UPDATE wallets SET balance = 0 WHERE user_id = u.id;
        UPDATE funds SET balance = 0 WHERE user_id = u.id;
        
        -- B. Rebuild TOTAL CAPITAL Fund
        SELECT id INTO f_cap FROM funds WHERE user_id = u.id AND type = 'TOTAL_CAPITAL' LIMIT 1;
        
        IF f_cap IS NOT NULL THEN
            UPDATE funds SET balance = (
                COALESCE((SELECT SUM(amount) FROM contributions WHERE user_id = u.id), 0) +
                COALESCE((SELECT SUM(total_revenue) FROM harvest_batches WHERE user_id = u.id), 0)
            ) WHERE id = f_cap;

            -- Deduct/Add from TOTAL CAPITAL based on fund transfers (Withdrawals)
            UPDATE funds SET balance = balance - COALESCE((SELECT SUM(amount) FROM fund_transfers WHERE from_fund_id = f_cap), 0) WHERE id = f_cap;
            UPDATE funds SET balance = balance + COALESCE((SELECT SUM(amount) FROM fund_transfers WHERE to_fund_id = f_cap), 0) WHERE id = f_cap;
        END IF;

        -- C. Rebuild Wallets (Only Loans, Withdrawals IN; Expenses, Payments OUT)
        FOR w IN (SELECT id, type FROM wallets WHERE user_id = u.id) LOOP
            UPDATE wallets SET balance = (
                COALESCE((SELECT SUM(principal_amount) FROM loans WHERE user_id = u.id AND wallet_id = w.id), 0) +
                COALESCE((SELECT SUM(amount) FROM fund_transfers WHERE to_wallet_id = w.id), 0) -
                COALESCE((SELECT SUM(amount) FROM fund_transfers WHERE from_wallet_id = w.id), 0) -
                COALESCE((SELECT SUM(amount) FROM expenses WHERE user_id = u.id AND wallet_id = w.id), 0) -
                COALESCE((SELECT SUM(amount) FROM debt_payments WHERE user_id = u.id AND wallet_id = w.id), 0) -
                COALESCE((SELECT SUM(amount) FROM loan_repayments WHERE user_id = u.id AND wallet_id = w.id), 0) -
                COALESCE((SELECT SUM(amount) FROM salary_advances_payments WHERE user_id = u.id AND wallet_id = w.id), 0)
            ) WHERE id = w.id;
        END LOOP;

        -- D. Rebuild EXPENSE FUND (sum of wallets, since wallets ARE the true operating expense fund)
        SELECT id INTO f_exp FROM funds WHERE user_id = u.id AND type = 'EXPENSE_FUND' LIMIT 1;
        
        IF f_exp IS NOT NULL THEN
            UPDATE funds SET balance = COALESCE((SELECT SUM(balance) FROM wallets WHERE user_id = u.id), 0) WHERE id = f_exp;
        END IF;

    END LOOP;
END;
$$ LANGUAGE plpgsql;
