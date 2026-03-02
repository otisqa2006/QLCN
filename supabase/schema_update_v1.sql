-- ==========================================
-- QLCN Sprint 6: Multi-Farm & Multi-Season Migration
-- ==========================================
-- This script migrates the existing schema to support multiple Farms per User,
-- and multiple Seasons per Farm. It safely moves existing data into a "Default"
-- Farm and Season to prevent data loss.

-- 1. Create Farms Table
CREATE TABLE IF NOT EXISTS farms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    area DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, name)
);

ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own farms" ON farms FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own farms" ON farms FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own farms" ON farms FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own farms" ON farms FOR DELETE USING (auth.uid() = user_id);

-- 2. Modify Harvest Seasons (Link to Farms)
ALTER TABLE harvest_seasons ADD COLUMN IF NOT EXISTS farm_id UUID REFERENCES farms(id) ON DELETE CASCADE;

-- Update existing Seasons to link to a default farm that we will create shortly
-- (Wait until data migration block below)

-- 3. Add Context Columns to Tables
-- Plots belong to a Farm
ALTER TABLE plots ADD COLUMN IF NOT EXISTS farm_id UUID REFERENCES farms(id) ON DELETE CASCADE;

-- Inventory belongs to a Farm 
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS farm_id UUID REFERENCES farms(id) ON DELETE CASCADE;
-- Mảng UNIQUE cũ (user_id, name) giờ cần lỏng ra hoặc chuyển thành (farm_id, name). 
-- Tuy nhiên PostgreSQL không cho DROP UNIQUE CONSTRAINT dễ nếu không biết tên.
-- Tạm thời bỏ qua constraint cũ, thêm constraint mới.
ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_farm_id_name_key UNIQUE (farm_id, name);

-- Workers belong to a Farm
ALTER TABLE workers ADD COLUMN IF NOT EXISTS farm_id UUID REFERENCES farms(id) ON DELETE CASCADE;

-- Expenses & Debts belong to BOTH Farm & Season
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS farm_id UUID REFERENCES farms(id) ON DELETE CASCADE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES harvest_seasons(id) ON DELETE CASCADE;

ALTER TABLE debts ADD COLUMN IF NOT EXISTS farm_id UUID REFERENCES farms(id) ON DELETE CASCADE;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES harvest_seasons(id) ON DELETE CASCADE;

-- Farm Logs belong to a Season (since plots already belong to Farm)
ALTER TABLE farm_logs ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES harvest_seasons(id) ON DELETE CASCADE;

-- Timesheets belong to a Season
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES harvest_seasons(id) ON DELETE CASCADE;


-- ==========================================
-- 4. DATA MIGRATION SCRIPT (SAFE FALLBACK)
-- ==========================================
DO $$
DECLARE
    u RECORD;
    default_farm_id UUID;
    default_season_id UUID;
BEGIN
    FOR u IN SELECT id FROM auth.users LOOP
        -- A. Create a Default Farm for this user (if they don't have one)
        SELECT id INTO default_farm_id FROM farms WHERE user_id = u.id AND name = 'Vườn Mặc Định' LIMIT 1;
        
        IF default_farm_id IS NULL THEN
            INSERT INTO farms (user_id, name, location, area) 
            VALUES (u.id, 'Vườn Mặc Định', 'N/A', 1.0)
            RETURNING id INTO default_farm_id;
        END IF;

        -- B. Create a Default Season for this Default Farm (if they don't have one)
        SELECT id INTO default_season_id FROM harvest_seasons WHERE user_id = u.id AND farm_id = default_farm_id AND name = 'Vụ Mặc Định' LIMIT 1;

        IF default_season_id IS NULL THEN
            INSERT INTO harvest_seasons (user_id, farm_id, name, year, status)
            VALUES (u.id, default_farm_id, 'Vụ Mặc Định', EXTRACT(YEAR FROM CURRENT_DATE), 'IN_PROGRESS')
            RETURNING id INTO default_season_id;
        END IF;

        -- C. Migrate All Existing Data to these Defaults
        
        -- Migrate Seasons (that existed before this script) to the default farm
        UPDATE harvest_seasons SET farm_id = default_farm_id WHERE user_id = u.id AND farm_id IS NULL;

        -- Migrate Plots
        UPDATE plots SET farm_id = default_farm_id WHERE user_id = u.id AND farm_id IS NULL;

        -- Migrate Inventory
        UPDATE inventory_items SET farm_id = default_farm_id WHERE user_id = u.id AND farm_id IS NULL;

        -- Migrate Workers
        UPDATE workers SET farm_id = default_farm_id WHERE user_id = u.id AND farm_id IS NULL;

        -- Migrate Expenses
        UPDATE expenses SET farm_id = default_farm_id, season_id = default_season_id WHERE user_id = u.id AND (farm_id IS NULL OR season_id IS NULL);

        -- Migrate Debts
        UPDATE debts SET farm_id = default_farm_id, season_id = default_season_id WHERE user_id = u.id AND (farm_id IS NULL OR season_id IS NULL);

        -- Migrate Farm Logs
        UPDATE farm_logs SET season_id = default_season_id WHERE user_id = u.id AND season_id IS NULL;

        -- Migrate Timesheets
        UPDATE timesheets SET season_id = default_season_id WHERE user_id = u.id AND season_id IS NULL;

    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. Enforce NOT NULL Constraints now that data is populated
ALTER TABLE harvest_seasons ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE plots ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE inventory_items ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE workers ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN season_id SET NOT NULL;
ALTER TABLE debts ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE debts ALTER COLUMN season_id SET NOT NULL;
ALTER TABLE farm_logs ALTER COLUMN season_id SET NOT NULL;
ALTER TABLE timesheets ALTER COLUMN season_id SET NOT NULL;


-- ==========================================
-- 6. UPDATE SEED DEFAULT INVENTORY FUNCTION
-- ==========================================
CREATE OR REPLACE FUNCTION public.seed_default_inventory() RETURNS TRIGGER AS $$
DECLARE
    new_farm_id UUID;
    new_season_id UUID;
BEGIN
  -- 1. Generate First Farm
  INSERT INTO public.farms (user_id, name, location, area) 
  VALUES (NEW.id, 'Vườn Nhà', 'Khu vực chính', 1.0)
  RETURNING id INTO new_farm_id;

  -- 2. Generate First Season
  INSERT INTO public.harvest_seasons (user_id, farm_id, name, year, status)
  VALUES (NEW.id, new_farm_id, 'Vụ Năm Nay', EXTRACT(YEAR FROM CURRENT_DATE), 'IN_PROGRESS')
  RETURNING id INTO new_season_id;

  -- 3. Seed Items into this Farm
  INSERT INTO public.inventory_items (user_id, farm_id, name, category, unit, stock_quantity) VALUES 
  (NEW.id, new_farm_id, 'Phân nước', 'PHAN_BON', 'LIT', 0),
  (NEW.id, new_farm_id, 'Humic', 'PHAN_BON', 'KG', 0),
  (NEW.id, new_farm_id, 'Fulvic', 'PHAN_BON', 'KG', 0),
  (NEW.id, new_farm_id, 'Tricoderma', 'PHAN_BON', 'KG', 0),
  (NEW.id, new_farm_id, 'Bacillus', 'PHAN_BON', 'KG', 0),
  (NEW.id, new_farm_id, 'NPK', 'PHAN_BON', 'BAO', 0),
  (NEW.id, new_farm_id, 'Thuốc trị nấm xì mủ', 'THUOC_BVTV', 'CHAI', 0),
  (NEW.id, new_farm_id, 'Thuốc trị mọt đục cành', 'THUOC_BVTV', 'CHAI', 0),
  (NEW.id, new_farm_id, 'Thuốc nhện đỏ', 'THUOC_BVTV', 'CHAI', 0);

  -- 4. Seed Plots into this Farm
  INSERT INTO public.plots (user_id, farm_id, name, tree_type, tree_count, planted_year) VALUES
  (NEW.id, new_farm_id, 'Lô 1', 'THAI_DONA', 160, EXTRACT(YEAR FROM CURRENT_DATE) - 12),
  (NEW.id, new_farm_id, 'Lô 2', 'RI6', 90, EXTRACT(YEAR FROM CURRENT_DATE) - 12);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
