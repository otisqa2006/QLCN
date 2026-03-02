-- ==========================================
-- QLCN Sprint 8: Expense Management Triggers (V5)
-- ==========================================
-- This update adds AFTER UPDATE and AFTER DELETE triggers to the `expenses` table.
-- It ensures that if an expense is modified or deleted, the corresponding
-- wallet and fund balances are accurately refunded and deducted.

-- 1. Trigger for UPDATE
CREATE OR REPLACE FUNCTION on_expense_update() RETURNS TRIGGER AS $$
BEGIN
    -- If wallet, fund, or amount changes, we revert the old and apply the new.
    -- To keep it simple and robust, we always revert OLD and apply NEW.
    
    -- Revert old amount from old wallet and fund
    UPDATE wallets SET balance = balance + OLD.amount WHERE id = OLD.wallet_id;
    UPDATE funds SET balance = balance + OLD.amount WHERE id = OLD.fund_id;
    
    -- Apply new amount to new wallet and fund
    UPDATE wallets SET balance = balance - NEW.amount WHERE id = NEW.wallet_id;
    UPDATE funds SET balance = balance - NEW.amount WHERE id = NEW.fund_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_expense_update ON expenses;
CREATE TRIGGER trigger_expense_update 
AFTER UPDATE ON expenses 
FOR EACH ROW 
EXECUTE PROCEDURE on_expense_update();


-- 2. Trigger for DELETE
CREATE OR REPLACE FUNCTION on_expense_delete() RETURNS TRIGGER AS $$
BEGIN
    -- Revert the amount back to the wallet and fund
    UPDATE wallets SET balance = balance + OLD.amount WHERE id = OLD.wallet_id;
    UPDATE funds SET balance = balance + OLD.amount WHERE id = OLD.fund_id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_expense_delete ON expenses;
CREATE TRIGGER trigger_expense_delete 
AFTER DELETE ON expenses 
FOR EACH ROW 
EXECUTE PROCEDURE on_expense_delete();
