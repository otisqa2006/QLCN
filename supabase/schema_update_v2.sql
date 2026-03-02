-- ==========================================
-- QLCN Sprint 6: Schema Update V2 (Patch)
-- ==========================================
-- This patches the `salary_advances_payments` table which was missed in v1.
-- Since this table triggers an INSERT into `expenses`, and `expenses` now
-- strictly requires `farm_id` and `season_id`, we must add these columns
-- and update the trigger.

-- 1. Add Columns
ALTER TABLE salary_advances_payments ADD COLUMN IF NOT EXISTS farm_id UUID REFERENCES farms(id) ON DELETE CASCADE;
ALTER TABLE salary_advances_payments ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES harvest_seasons(id) ON DELETE CASCADE;

-- 2. Backfill Data to Defaults
DO $$
DECLARE
    u RECORD;
    default_farm_id UUID;
    default_season_id UUID;
BEGIN
    FOR u IN SELECT id FROM auth.users LOOP
        -- Select the default farm and season we created in v1
        SELECT id INTO default_farm_id FROM farms WHERE user_id = u.id AND name = 'Vườn Mặc Định' LIMIT 1;
        SELECT id INTO default_season_id FROM harvest_seasons WHERE user_id = u.id AND farm_id = default_farm_id AND name = 'Vụ Mặc Định' LIMIT 1;

        -- Migrate Salary Payments
        UPDATE salary_advances_payments 
        SET farm_id = default_farm_id, season_id = default_season_id 
        WHERE user_id = u.id AND (farm_id IS NULL OR season_id IS NULL);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Enforce NOT NULL (Run only if you have old data, otherwise can be ignored if empty)
ALTER TABLE salary_advances_payments ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE salary_advances_payments ALTER COLUMN season_id SET NOT NULL;

-- 4. Update the Trigger Function to pass farm_id and season_id down to expenses
CREATE OR REPLACE FUNCTION on_salary_payment_insert() RETURNS TRIGGER AS $$
DECLARE
    salary_category_id UUID;
    new_expense_id UUID;
BEGIN
    -- Tìm Category 'Lương Nhân Công', nếu không có thì tạo mặc định
    SELECT id INTO salary_category_id FROM expense_categories WHERE user_id = NEW.user_id AND name = 'Lương Nhân Công' LIMIT 1;
    
    IF salary_category_id IS NULL THEN
        INSERT INTO expense_categories (user_id, name, icon_name, color_code) 
        VALUES (NEW.user_id, 'Lương Nhân Công', 'Users', '#3b82f6')
        RETURNING id INTO salary_category_id;
    END IF;

    -- Tạo một expense (Truyền farm_id và season_id từ NEW)
    INSERT INTO expenses (user_id, farm_id, season_id, category_id, wallet_id, fund_id, amount, description, date)
    VALUES (NEW.user_id, NEW.farm_id, NEW.season_id, salary_category_id, NEW.wallet_id, NEW.fund_id, NEW.amount, 
            CASE WHEN NEW.is_advance THEN 'Ứng lương nhân công' ELSE 'Trả lương nhân công' END || COALESCE(' - ' || NEW.notes, ''), 
            NEW.date)
    RETURNING id INTO new_expense_id;
    
    -- Cập nhật ID của expense ngược lại cho bản ghi lương
    UPDATE salary_advances_payments SET expense_id = new_expense_id WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
