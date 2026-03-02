-- ==========================================
-- QLCN Sprint 2: Expense Management & Supplier Debts Schema
-- ==========================================

-- 1. CLEANUP EXISTING TABLES (Optional for dev)
DROP TABLE IF EXISTS log_materials CASCADE;
DROP TABLE IF EXISTS farm_logs CASCADE;
DROP TABLE IF EXISTS plots CASCADE;
DROP TABLE IF EXISTS salary_advances_payments CASCADE;
DROP TABLE IF EXISTS timesheets CASCADE;
DROP TABLE IF EXISTS workers CASCADE;
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS debt_payments CASCADE;
DROP TABLE IF EXISTS debts CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS expense_categories CASCADE;
DROP TABLE IF EXISTS harvest_batches CASCADE;
DROP TABLE IF EXISTS harvest_seasons CASCADE;
DROP TABLE IF EXISTS loan_repayments CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS contributions CASCADE;
DROP TABLE IF EXISTS contributors CASCADE;
DROP TABLE IF EXISTS fund_transfers CASCADE;
DROP TABLE IF EXISTS funds CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;

-- 2. ENUMS
DROP TYPE IF EXISTS wallet_type CASCADE;
DROP TYPE IF EXISTS fund_type CASCADE;
DROP TYPE IF EXISTS tree_type CASCADE;
CREATE TYPE wallet_type AS ENUM ('BANK', 'CASH');
CREATE TYPE fund_type AS ENUM ('TOTAL_CAPITAL', 'EXPENSE_FUND');
CREATE TYPE tree_type AS ENUM ('RI6', 'THAI_DONA');

-- ==========================================
-- SECTION A: WALLETS & FUNDS
-- ==========================================

-- WALLETS (Ví Tiền Thực Tế)
CREATE TABLE wallets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    type wallet_type NOT NULL,
    balance DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, type)
);

-- FUNDS (Quỹ Kế Toán/Ngân Sách)
CREATE TABLE funds (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    type fund_type NOT NULL,
    balance DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, type)
);

-- FUND TRANSFERS (Lịch sử chuyển/rút quỹ/ví)
CREATE TABLE fund_transfers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    from_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
    to_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
    from_fund_id UUID REFERENCES funds(id) ON DELETE SET NULL,
    to_fund_id UUID REFERENCES funds(id) ON DELETE SET NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- SECTION B: NGUỒN VỐN (TIỀN VÀO)
-- ==========================================

-- CONTRIBUTORS (Người Góp Vốn)
CREATE TABLE contributors (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- CONTRIBUTIONS (Lịch Sử Góp Vốn) -> Tăng Tổng Vốn & Ví Bank/Cash
CREATE TABLE contributions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    contributor_id UUID REFERENCES contributors(id) ON DELETE CASCADE NOT NULL,
    wallet_id UUID REFERENCES wallets(id) ON DELETE RESTRICT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- LOANS (Khoản Vay)
CREATE TABLE loans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    source_name TEXT NOT NULL,
    principal_amount DECIMAL(15, 2) NOT NULL CHECK (principal_amount > 0),
    interest_rate_percent DECIMAL(5, 2) DEFAULT 0.00,
    wallet_id UUID REFERENCES wallets(id) ON DELETE RESTRICT NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAID_OFF')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- LOAN REPAYMENTS (Trả nợ khoản vay) -> Giảm Quỹ Chi Tiêu & Ví tương ứng
CREATE TABLE loan_repayments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE NOT NULL,
    wallet_id UUID REFERENCES wallets(id) ON DELETE RESTRICT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    is_interest BOOLEAN DEFAULT false,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- HARVEST SEASONS (Mùa vụ)
CREATE TABLE harvest_seasons (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    status TEXT DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- HARVEST BATCHES (Thu hoạch) -> Tăng Tổng Vốn & Ví tương ứng
CREATE TABLE harvest_batches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    season_id UUID REFERENCES harvest_seasons(id) ON DELETE CASCADE NOT NULL,
    wallet_id UUID REFERENCES wallets(id) ON DELETE RESTRICT NOT NULL,
    tree_type tree_type NOT NULL,
    weight_kg DECIMAL(10, 2) NOT NULL CHECK (weight_kg > 0),
    price_per_kg DECIMAL(15, 2) NOT NULL CHECK (price_per_kg > 0),
    total_revenue DECIMAL(15, 2) GENERATED ALWAYS AS (weight_kg * price_per_kg) STORED,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- SECTION C: CHI TIÊU VÀ CÔNG NỢ ĐẠI LÝ (TIỀN RA)
-- ==========================================

-- EXPENSE CATEGORIES (Danh mục chi tiêu)
CREATE TABLE expense_categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    icon_name TEXT,
    color_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SUPPLIERS (Đại lý vật tư)
CREATE TABLE suppliers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- EXPENSES (Chi phí hàng ngày)
CREATE TABLE expenses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    farm_id UUID REFERENCES farms(id) ON DELETE CASCADE NOT NULL,
    season_id UUID REFERENCES harvest_seasons(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES expense_categories(id) ON DELETE RESTRICT NOT NULL,
    wallet_id UUID REFERENCES wallets(id) ON DELETE RESTRICT NOT NULL,
    fund_id UUID REFERENCES funds(id) ON DELETE RESTRICT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    is_archived BOOLEAN DEFAULT false,  -- v7: soft delete support
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- DEBTS (Sổ Công Nợ Đại Lý)
CREATE TABLE debts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT NOT NULL,
    description TEXT NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL CHECK (total_amount > 0),
    paid_amount DECIMAL(15, 2) DEFAULT 0.00 NOT NULL CHECK (paid_amount >= 0),
    status TEXT DEFAULT 'DANG_NO' CHECK (status IN ('DANG_NO', 'DA_XONG')),
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- DEBT PAYMENTS (Trả nợ đại lý) -> Giảm Ví, Quỹ, Tăng paid_amount bảng debts
CREATE TABLE debt_payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    debt_id UUID REFERENCES debts(id) ON DELETE CASCADE NOT NULL,
    wallet_id UUID REFERENCES wallets(id) ON DELETE RESTRICT NOT NULL,
    fund_id UUID REFERENCES funds(id) ON DELETE RESTRICT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- SECTION D: ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE harvest_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE harvest_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION set_user_policies(table_name text) RETURNS void AS $$
BEGIN
    EXECUTE format('
        CREATE POLICY "Users can view own %1$I" ON %1$I FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert own %1$I" ON %1$I FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update own %1$I" ON %1$I FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete own %1$I" ON %1$I FOR DELETE USING (auth.uid() = user_id);
    ', table_name);
END;
$$ LANGUAGE plpgsql;

SELECT set_user_policies('wallets');
SELECT set_user_policies('funds');
SELECT set_user_policies('fund_transfers');
SELECT set_user_policies('contributors');
SELECT set_user_policies('contributions');
SELECT set_user_policies('loans');
SELECT set_user_policies('loan_repayments');
SELECT set_user_policies('harvest_seasons');
SELECT set_user_policies('harvest_batches');
SELECT set_user_policies('expense_categories');
SELECT set_user_policies('suppliers');
SELECT set_user_policies('expenses');
SELECT set_user_policies('debts');
SELECT set_user_policies('debt_payments');

-- ==========================================
-- SECTION E: POSTGRES TRIGGERS
-- ==========================================

-- 1. Create Wallets & Funds for new user
CREATE OR REPLACE FUNCTION public.handle_new_user_wallets() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (user_id, type) VALUES (NEW.id, 'BANK'), (NEW.id, 'CASH');
  INSERT INTO public.funds (user_id, type) VALUES (NEW.id, 'TOTAL_CAPITAL'), (NEW.id, 'EXPENSE_FUND');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_wallets ON auth.users;
CREATE TRIGGER on_auth_user_created_wallets AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_wallets();

-- 2. Trigger Góp Vốn -> Tăng ví & Tăng TỔNG VỐN
CREATE OR REPLACE FUNCTION on_contribution_insert() RETURNS TRIGGER AS $$
BEGIN
    UPDATE wallets SET balance = balance + NEW.amount WHERE id = NEW.wallet_id;
    UPDATE funds SET balance = balance + NEW.amount WHERE user_id = NEW.user_id AND type = 'TOTAL_CAPITAL';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_contribution_insert AFTER INSERT ON contributions FOR EACH ROW EXECUTE PROCEDURE on_contribution_insert();

-- 3. Trigger Khoản Vay -> Tăng ví (không đưa vào quỹ chi tiêu vì vay là tiền riêng)
CREATE OR REPLACE FUNCTION on_loan_insert() RETURNS TRIGGER AS $$
BEGIN
    UPDATE wallets SET balance = balance + NEW.principal_amount WHERE id = NEW.wallet_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_loan_insert AFTER INSERT ON loans FOR EACH ROW EXECUTE PROCEDURE on_loan_insert();

-- 4. Trigger Trả Nợ Vay -> Giảm ví (không trừ từ quỹ chi tiêu vì vay là tiền riêng)
CREATE OR REPLACE FUNCTION on_loan_repayment_insert() RETURNS TRIGGER AS $$
BEGIN
    UPDATE wallets SET balance = balance - NEW.amount WHERE id = NEW.wallet_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_loan_repayment_insert AFTER INSERT ON loan_repayments FOR EACH ROW EXECUTE PROCEDURE on_loan_repayment_insert();

-- 5. Trigger Thu Hoạch -> Tăng ví & Tăng TỔNG VỐN
CREATE OR REPLACE FUNCTION on_harvest_insert() RETURNS TRIGGER AS $$
BEGIN
    UPDATE wallets SET balance = balance + NEW.total_revenue WHERE id = NEW.wallet_id;
    UPDATE funds SET balance = balance + NEW.total_revenue WHERE user_id = NEW.user_id AND type = 'TOTAL_CAPITAL';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_harvest_insert AFTER INSERT ON harvest_batches FOR EACH ROW EXECUTE PROCEDURE on_harvest_insert();

-- 6. Trigger Chi Tiêu Mới -> Giảm Ví & Giảm Quỹ
CREATE OR REPLACE FUNCTION on_expense_insert() RETURNS TRIGGER AS $$
BEGIN
    UPDATE wallets SET balance = balance - NEW.amount WHERE id = NEW.wallet_id;
    UPDATE funds SET balance = balance - NEW.amount WHERE id = NEW.fund_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_expense_insert AFTER INSERT ON expenses FOR EACH ROW EXECUTE PROCEDURE on_expense_insert();

-- 7. Trigger Trả Nợ Công Nợ Đại Lý -> Giảm Ví, Giảm Quỹ, Tăng paid_amount
CREATE OR REPLACE FUNCTION on_debt_payment_insert() RETURNS TRIGGER AS $$
BEGIN
    UPDATE wallets SET balance = balance - NEW.amount WHERE id = NEW.wallet_id;
    UPDATE funds SET balance = balance - NEW.amount WHERE id = NEW.fund_id;
    
    UPDATE debts 
    SET paid_amount = paid_amount + NEW.amount,
        status = CASE 
                    WHEN (paid_amount + NEW.amount) >= total_amount THEN 'DA_XONG'
                    ELSE 'DANG_NO'
                 END
    WHERE id = NEW.debt_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_debt_payment_insert AFTER INSERT ON debt_payments FOR EACH ROW EXECUTE PROCEDURE on_debt_payment_insert();

-- 8. Trigger Fund Transfers 
CREATE OR REPLACE FUNCTION on_fund_transfer_insert() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.from_fund_id IS NOT NULL THEN
        UPDATE funds SET balance = balance - NEW.amount WHERE id = NEW.from_fund_id;
    END IF;
    IF NEW.to_fund_id IS NOT NULL THEN
        UPDATE funds SET balance = balance + NEW.amount WHERE id = NEW.to_fund_id;
    END IF;
    IF NEW.from_wallet_id IS NOT NULL THEN
        UPDATE wallets SET balance = balance - NEW.amount WHERE id = NEW.from_wallet_id;
    END IF;
    IF NEW.to_wallet_id IS NOT NULL THEN
        UPDATE wallets SET balance = balance + NEW.amount WHERE id = NEW.to_wallet_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_fund_transfer_insert AFTER INSERT ON fund_transfers FOR EACH ROW EXECUTE PROCEDURE on_fund_transfer_insert();

-- ==========================================
-- QLCN Sprint 3: Inventory & Labor Management Schema
-- ==========================================

-- 1. ENUMS (Sprint 3)
DROP TYPE IF EXISTS item_category CASCADE;
DROP TYPE IF EXISTS item_unit CASCADE;
DROP TYPE IF EXISTS worker_type CASCADE;
DROP TYPE IF EXISTS timesheet_status CASCADE;
DROP TYPE IF EXISTS transaction_type CASCADE;
CREATE TYPE item_category AS ENUM ('PHAN_BON', 'THUOC_BVTV', 'KHAC');
CREATE TYPE item_unit AS ENUM ('CHAI', 'BAO', 'LIT', 'KG');
CREATE TYPE worker_type AS ENUM ('DAILY', 'YEARLY');
CREATE TYPE timesheet_status AS ENUM ('NGHI', 'NUA_NGAY', 'CA_NGAY');
CREATE TYPE transaction_type AS ENUM ('IN', 'OUT');

-- ==========================================
-- SECTION F: INVENTORY (QUẢN LÝ KHO)
-- ==========================================

-- INVENTORY ITEMS (Danh mục vật tư)
CREATE TABLE inventory_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    category item_category NOT NULL,
    unit item_unit NOT NULL,
    stock_quantity DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, name)
);

-- INVENTORY TRANSACTIONS (Lịch sử Nhập/Xuất kho)
CREATE TABLE inventory_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE NOT NULL,
    type transaction_type NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL CHECK (quantity > 0),
    reference_id UUID, -- Optional: có thể trỏ tới expenses.id hoặc debts.id
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- SECTION G: LABOR (QUẢN LÝ NHÂN CÔNG)
-- ==========================================

-- WORKERS (Danh sách nhân công)
CREATE TABLE workers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    worker_type worker_type NOT NULL,
    daily_wage DECIMAL(15, 2) DEFAULT 0.00,
    yearly_salary DECIMAL(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TIMESHEETS (Chấm công hàng ngày)
CREATE TABLE timesheets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    status timesheet_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(worker_id, date)
);

-- SALARY ADVANCES & PAYMENTS (Ghi nhận ứng lương / trả lương)
-- Trigger sẽ sinh ra 1 khoản chi (expense) để trừ tiền thật
CREATE TABLE salary_advances_payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE NOT NULL,
    wallet_id UUID REFERENCES wallets(id) ON DELETE RESTRICT NOT NULL,
    fund_id UUID REFERENCES funds(id) ON DELETE RESTRICT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    is_advance BOOLEAN DEFAULT false,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    notes TEXT,
    expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL, -- Lưu vết sang bảng expenses
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- ==========================================
-- SECTION H: SPRINT 3 RLS & TRIGGERS
-- ==========================================

-- RLS
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_advances_payments ENABLE ROW LEVEL SECURITY;

SELECT set_user_policies('inventory_items');
SELECT set_user_policies('inventory_transactions');
SELECT set_user_policies('workers');
SELECT set_user_policies('timesheets');
SELECT set_user_policies('salary_advances_payments');

-- 9. Trigger Inventory Transaction -> Update Stock Quantity
CREATE OR REPLACE FUNCTION on_inventory_transaction_insert() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type = 'IN' THEN
        UPDATE inventory_items SET stock_quantity = stock_quantity + NEW.quantity WHERE id = NEW.item_id;
    ELSIF NEW.type = 'OUT' THEN
        UPDATE inventory_items SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.item_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_inventory_transaction_insert AFTER INSERT ON inventory_transactions FOR EACH ROW EXECUTE PROCEDURE on_inventory_transaction_insert();

-- 10. Trigger Salary Payment -> Tạo Expense
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

    -- Tạo một expense
    INSERT INTO expenses (user_id, category_id, wallet_id, fund_id, amount, description, date)
    VALUES (NEW.user_id, salary_category_id, NEW.wallet_id, NEW.fund_id, NEW.amount, 
            CASE WHEN NEW.is_advance THEN 'Ứng lương nhân công' ELSE 'Trả lương nhân công' END || COALESCE(' - ' || NEW.notes, ''), 
            NEW.date)
    RETURNING id INTO new_expense_id;
    
    -- Cập nhật ID của expense ngược lại cho bản ghi lương
    UPDATE salary_advances_payments SET expense_id = new_expense_id WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_salary_payment_insert AFTER INSERT ON salary_advances_payments FOR EACH ROW EXECUTE PROCEDURE on_salary_payment_insert();

-- 11. Function Setup Default Inventory (Seed Data cho người dùng mới)
CREATE OR REPLACE FUNCTION public.seed_default_inventory() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.inventory_items (user_id, name, category, unit, stock_quantity) VALUES 
  (NEW.id, 'Phân nước', 'PHAN_BON', 'LIT', 0),
  (NEW.id, 'Humic', 'PHAN_BON', 'KG', 0),
  (NEW.id, 'Fulvic', 'PHAN_BON', 'KG', 0),
  (NEW.id, 'Tricoderma', 'PHAN_BON', 'KG', 0),
  (NEW.id, 'Bacillus', 'PHAN_BON', 'KG', 0),
  (NEW.id, 'NPK', 'PHAN_BON', 'BAO', 0),
  (NEW.id, 'Thuốc trị nấm xì mủ', 'THUOC_BVTV', 'CHAI', 0),
  (NEW.id, 'Thuốc trị mọt đục cành', 'THUOC_BVTV', 'CHAI', 0),
  (NEW.id, 'Thuốc nhện đỏ', 'THUOC_BVTV', 'CHAI', 0);

  INSERT INTO public.plots (user_id, name, tree_type, tree_count, planted_year) VALUES
  (NEW.id, 'Lô 1', 'THAI_DONA', 160, EXTRACT(YEAR FROM CURRENT_DATE) - 12),
  (NEW.id, 'Lô 2', 'RI6', 90, EXTRACT(YEAR FROM CURRENT_DATE) - 12);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gắn thêm trigger seed inventory vào sự kiện tạo user (cùng với việc tạo ví)
DROP TRIGGER IF EXISTS on_auth_user_created_inventory ON auth.users;
CREATE TRIGGER on_auth_user_created_inventory AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.seed_default_inventory();

-- ==========================================
-- QLCN Sprint 4: Farm Management Schema
-- ==========================================

-- 1. Plots Table
CREATE TABLE plots (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    tree_type tree_type NOT NULL,
    tree_count INTEGER NOT NULL,
    planted_year INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE plots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select own plots" ON plots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own plots" ON plots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plots" ON plots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plots" ON plots FOR DELETE USING (auth.uid() = user_id);

-- 2. Farm Logs
CREATE TABLE farm_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    plot_id UUID REFERENCES plots(id) ON DELETE CASCADE NOT NULL,
    action_type TEXT NOT NULL,
    worker_id UUID REFERENCES workers(id) ON DELETE SET NULL, -- Optional if done by specific worker
    notes TEXT,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE farm_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select own farm_logs" ON farm_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own farm_logs" ON farm_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own farm_logs" ON farm_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own farm_logs" ON farm_logs FOR DELETE USING (auth.uid() = user_id);

-- 3. Log Materials
CREATE TABLE log_materials (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    log_id UUID REFERENCES farm_logs(id) ON DELETE CASCADE NOT NULL,
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE NOT NULL,
    quantity_used DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE log_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select own log_materials" ON log_materials FOR SELECT USING (
    EXISTS (SELECT 1 FROM farm_logs WHERE farm_logs.id = log_materials.log_id AND farm_logs.user_id = auth.uid())
);
CREATE POLICY "Users can insert own log_materials" ON log_materials FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM farm_logs WHERE farm_logs.id = log_id AND farm_logs.user_id = auth.uid())
);
CREATE POLICY "Users can update own log_materials" ON log_materials FOR UPDATE USING (
    EXISTS (SELECT 1 FROM farm_logs WHERE farm_logs.id = log_id AND farm_logs.user_id = auth.uid())
);
CREATE POLICY "Users can delete own log_materials" ON log_materials FOR DELETE USING (
    EXISTS (SELECT 1 FROM farm_logs WHERE farm_logs.id = log_id AND farm_logs.user_id = auth.uid())
);

-- 4. Trigger for Stock Updates from Log Materials
CREATE OR REPLACE FUNCTION update_inventory_on_log_material_change() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Giảm tồn kho
        UPDATE inventory_items 
        SET stock_quantity = stock_quantity - NEW.quantity_used 
        WHERE id = NEW.inventory_item_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Hoàn lại tồn kho
        UPDATE inventory_items 
        SET stock_quantity = stock_quantity + OLD.quantity_used 
        WHERE id = OLD.inventory_item_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Điều chỉnh tồn kho (cộng lại cũ, trừ đi mới)
        IF OLD.inventory_item_id = NEW.inventory_item_id THEN
            UPDATE inventory_items 
            SET stock_quantity = stock_quantity + OLD.quantity_used - NEW.quantity_used
            WHERE id = NEW.inventory_item_id;
        ELSE
            -- Trường hợp thay đổi mặt hàng (ít xảy ra nhưng để an toàn)
            UPDATE inventory_items SET stock_quantity = stock_quantity + OLD.quantity_used WHERE id = OLD.inventory_item_id;
            UPDATE inventory_items SET stock_quantity = stock_quantity - NEW.quantity_used WHERE id = NEW.inventory_item_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_log_material_change 
AFTER INSERT OR UPDATE OR DELETE ON log_materials 
FOR EACH ROW EXECUTE PROCEDURE update_inventory_on_log_material_change();

-- ==========================================
-- QLCN Sprint 5: Dashboard & Reporting RPCs
-- ==========================================

-- 1. Financial Summary
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

-- 2. Expense Breakdown (v8: supports MONTH or SEASON filter)
DROP FUNCTION IF EXISTS get_expense_breakdown(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_expense_breakdown(UUID, INTEGER, INTEGER, UUID, UUID);
DROP FUNCTION IF EXISTS get_expense_breakdown(UUID, TEXT, UUID, UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_expense_breakdown(
    p_user_id UUID,
    p_filter_type TEXT, -- 'MONTH' or 'SEASON'
    p_farm_id UUID DEFAULT NULL,
    p_season_id UUID DEFAULT NULL,
    p_month INTEGER DEFAULT NULL,
    p_year INTEGER DEFAULT NULL
)
RETURNS TABLE (
    category_name TEXT,
    total_amount DECIMAL(15, 2),
    color_code TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ec.name AS category_name,
        SUM(e.amount) AS total_amount,
        ec.color_code
    FROM expenses e
    JOIN expense_categories ec ON e.category_id = ec.id
    WHERE e.user_id = p_user_id
      AND e.is_archived = false
      AND (p_farm_id IS NULL OR e.farm_id = p_farm_id)
      AND (
          (p_filter_type = 'MONTH' AND EXTRACT(MONTH FROM e.date) = COALESCE(p_month, EXTRACT(MONTH FROM CURRENT_DATE)) AND EXTRACT(YEAR FROM e.date) = COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)))
          OR
          (p_filter_type = 'SEASON' AND (p_season_id IS NULL OR e.season_id = p_season_id))
      )
    GROUP BY ec.name, ec.color_code
    ORDER BY total_amount DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Harvest vs Cost (All time or by specific season)
-- Calculates total expenses vs total harvest revenue.
CREATE OR REPLACE FUNCTION get_harvest_vs_cost(p_user_id UUID)
RETURNS TABLE (
    total_cost DECIMAL(15, 2),
    total_revenue DECIMAL(15, 2),
    profit DECIMAL(15, 2)
) AS $$
DECLARE
    v_total_cost DECIMAL(15, 2);
    v_total_revenue DECIMAL(15, 2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_total_cost FROM expenses WHERE user_id = p_user_id;
    SELECT COALESCE(SUM(weight_kg * price_per_kg), 0) INTO v_total_revenue FROM harvest_batches WHERE user_id = p_user_id;
    
    RETURN QUERY SELECT v_total_cost, v_total_revenue, (v_total_revenue - v_total_cost) as profit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Low Stock Alerts
CREATE OR REPLACE FUNCTION get_low_stock_alerts(p_user_id UUID)
RETURNS TABLE (
    item_id UUID,
    item_name TEXT,
    category item_category,
    unit item_unit,
    stock_quantity DECIMAL(10, 2)
) AS $$
BEGIN
    -- Ngưỡng cảnh báo: 5 cho chai/bao/lit/kg chung, có thể tùy chỉnh thêm nếu cần
    RETURN QUERY
    SELECT id, name, category, unit, inventory_items.stock_quantity
    FROM inventory_items
    WHERE user_id = p_user_id AND inventory_items.stock_quantity <= 5.0
    ORDER BY inventory_items.stock_quantity ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Plot Status
CREATE OR REPLACE FUNCTION get_plot_status(p_user_id UUID)
RETURNS TABLE (
    plot_id UUID,
    plot_name TEXT,
    tree_type tree_type,
    tree_count INTEGER,
    last_action TEXT,
    last_action_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.tree_type,
        p.tree_count,
        fl.action_type AS last_action,
        fl.date AS last_action_date
    FROM plots p
    LEFT JOIN LATERAL (
        SELECT action_type, date
        FROM farm_logs
        WHERE plot_id = p.id
        ORDER BY date DESC, created_at DESC
        LIMIT 1
    ) fl ON true
    WHERE p.user_id = p_user_id
    ORDER BY p.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- QLCN Sprint 6: Multi-Farm & Multi-Season Schema
-- ==========================================

-- NOTE: If you are running this for the first time on an existing database, 
-- you must run the `schema_update_v1.sql` script first to gracefully map old data 
-- to a "Default Farm" to avoid violating NOT NULL constraints below.

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

-- 2. Modify Existing Tables to link to Farms and Seasons
-- WARNING: These commands assume the columns were added and populated by the migration script.
-- If running a fresh instance, you can uncomment these. For now, we rely on schema_update_v1.sql 
-- to handle the ALTER TABLE constraints dynamically.

-- ALTER TABLE harvest_seasons ADD COLUMN farm_id UUID REFERENCES farms(id) ON DELETE CASCADE NOT NULL;
-- ALTER TABLE plots ADD COLUMN farm_id UUID REFERENCES farms(id) ON DELETE CASCADE NOT NULL;
-- ALTER TABLE inventory_items ADD COLUMN farm_id UUID REFERENCES farms(id) ON DELETE CASCADE NOT NULL;
-- ALTER TABLE workers ADD COLUMN farm_id UUID REFERENCES farms(id) ON DELETE CASCADE NOT NULL;

-- ALTER TABLE expenses ADD COLUMN farm_id UUID REFERENCES farms(id) ON DELETE CASCADE NOT NULL;
-- ALTER TABLE expenses ADD COLUMN season_id UUID REFERENCES harvest_seasons(id) ON DELETE CASCADE NOT NULL;
-- ALTER TABLE debts ADD COLUMN farm_id UUID REFERENCES farms(id) ON DELETE CASCADE NOT NULL;
-- ALTER TABLE debts ADD COLUMN season_id UUID REFERENCES harvest_seasons(id) ON DELETE CASCADE NOT NULL;

-- ALTER TABLE farm_logs ADD COLUMN season_id UUID REFERENCES harvest_seasons(id) ON DELETE CASCADE NOT NULL;
-- ALTER TABLE timesheets ADD COLUMN season_id UUID REFERENCES harvest_seasons(id) ON DELETE CASCADE NOT NULL;

-- 3. Patch for Salary Payments (Sprint 6, schema_update_v2)
-- ALTER TABLE salary_advances_payments ADD COLUMN farm_id UUID REFERENCES farms(id) ON DELETE CASCADE NOT NULL;
-- ALTER TABLE salary_advances_payments ADD COLUMN season_id UUID REFERENCES harvest_seasons(id) ON DELETE CASCADE NOT NULL;
-- The on_salary_payment_insert trigger has also been updated above to cascade these IDs into expenses.

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

-- ==========================================
-- QLCN V9: RBAC — Profiles, Farm Members & Feature-Level Permissions
-- ==========================================

-- 1. PROFILES TABLE (system-wide user info + is_admin flag)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT DEFAULT '',
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_admin)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE WHEN NEW.email = 'betokutin@gmail.com' THEN true ELSE false END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_profile();

-- Seed existing users (run once; skipped on fresh installs)
INSERT INTO public.profiles (id, email, full_name, is_admin)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', ''),
  CASE WHEN email = 'betokutin@gmail.com' THEN true ELSE false END
FROM auth.users
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles SET is_admin = true WHERE email = 'betokutin@gmail.com';

-- RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE USING (
  (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true
);


-- 2. FARM MEMBERS TABLE (farm-level roles + feature permissions)
CREATE TYPE farm_role AS ENUM ('OWNER', 'MANAGER', 'WORKER');

CREATE TABLE public.farm_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role farm_role DEFAULT 'WORKER' NOT NULL,
    permissions JSONB DEFAULT '{
      "dashboard": true, "expenses": true, "harvest": true, "capital": true,
      "debts": true, "inventory": true, "labor": true, "diary": true,
      "expense_categories": true, "withdraw": true
    }'::jsonb NOT NULL,
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(farm_id, user_id)
);

-- Auto-add OWNER when a farm is created
CREATE OR REPLACE FUNCTION public.handle_new_farm_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.farm_members (farm_id, user_id, role, permissions)
  VALUES (NEW.id, NEW.user_id, 'OWNER',
    '{"dashboard":true,"expenses":true,"harvest":true,"capital":true,"debts":true,"inventory":true,"labor":true,"diary":true,"expense_categories":true,"withdraw":true}'::jsonb
  )
  ON CONFLICT (farm_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_farm_created_add_owner ON public.farms;
CREATE TRIGGER on_farm_created_add_owner
  AFTER INSERT ON public.farms
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_farm_member();

-- Seed existing farm creators as OWNER
INSERT INTO public.farm_members (farm_id, user_id, role, permissions)
SELECT id, user_id, 'OWNER',
  '{"dashboard":true,"expenses":true,"harvest":true,"capital":true,"debts":true,"inventory":true,"labor":true,"diary":true,"expense_categories":true,"withdraw":true}'::jsonb
FROM public.farms
ON CONFLICT (farm_id, user_id) DO NOTHING;


-- 3. SECURITY DEFINER HELPERS (bypass RLS to avoid infinite recursion in policies)
CREATE OR REPLACE FUNCTION public.auth_is_farm_member(p_farm_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM farm_members WHERE farm_id = p_farm_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.auth_is_farm_owner(p_farm_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM farm_members WHERE farm_id = p_farm_id AND user_id = auth.uid() AND role = 'OWNER');
$$;

CREATE OR REPLACE FUNCTION public.auth_is_system_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false);
$$;


-- 4. RLS for farm_members (uses helper functions — no recursion)
ALTER TABLE public.farm_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "farm_members_select" ON public.farm_members;
DROP POLICY IF EXISTS "farm_members_insert" ON public.farm_members;
DROP POLICY IF EXISTS "farm_members_update" ON public.farm_members;
DROP POLICY IF EXISTS "farm_members_delete" ON public.farm_members;

CREATE POLICY "farm_members_select" ON public.farm_members FOR SELECT USING (
  public.auth_is_farm_member(farm_id) OR public.auth_is_system_admin()
);
CREATE POLICY "farm_members_insert" ON public.farm_members FOR INSERT WITH CHECK (
  public.auth_is_farm_owner(farm_id) OR public.auth_is_system_admin()
);
CREATE POLICY "farm_members_update" ON public.farm_members FOR UPDATE USING (
  public.auth_is_farm_owner(farm_id) OR public.auth_is_system_admin()
);
CREATE POLICY "farm_members_delete" ON public.farm_members FOR DELETE USING (
  public.auth_is_farm_owner(farm_id) OR public.auth_is_system_admin()
);


-- 5. FARMS RLS — replace old user_id-based policies with membership-based ones
DROP POLICY IF EXISTS "Users can view own farms" ON public.farms;
DROP POLICY IF EXISTS "Users can insert own farms" ON public.farms;
DROP POLICY IF EXISTS "Users can update own farms" ON public.farms;
DROP POLICY IF EXISTS "Users can delete own farms" ON public.farms;
DROP POLICY IF EXISTS "farms_select" ON public.farms;
DROP POLICY IF EXISTS "farms_insert" ON public.farms;
DROP POLICY IF EXISTS "farms_update" ON public.farms;
DROP POLICY IF EXISTS "farms_delete" ON public.farms;

CREATE POLICY "farms_select" ON public.farms FOR SELECT USING (
  public.auth_is_farm_member(id) OR public.auth_is_system_admin()
);
CREATE POLICY "farms_insert" ON public.farms FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "farms_update" ON public.farms FOR UPDATE USING (
  public.auth_is_farm_owner(id) OR public.auth_is_system_admin()
);
CREATE POLICY "farms_delete" ON public.farms FOR DELETE USING (
  public.auth_is_farm_owner(id) OR public.auth_is_system_admin()
);


-- 6. RPCs for role/permission management

CREATE OR REPLACE FUNCTION public.get_my_farm_role(p_farm_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_role TEXT;
BEGIN
  IF public.auth_is_system_admin() THEN RETURN 'ADMIN'; END IF;
  SELECT role::text INTO v_role FROM public.farm_members WHERE farm_id = p_farm_id AND user_id = auth.uid();
  RETURN COALESCE(v_role, 'NONE');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_farm_permissions(p_farm_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role TEXT; v_permissions JSONB;
  v_all JSONB := '{"dashboard":true,"expenses":true,"harvest":true,"capital":true,"debts":true,"inventory":true,"labor":true,"diary":true,"expense_categories":true,"withdraw":true}'::jsonb;
BEGIN
  IF public.auth_is_system_admin() THEN RETURN v_all; END IF;
  SELECT role::text, permissions INTO v_role, v_permissions
  FROM public.farm_members WHERE farm_id = p_farm_id AND user_id = auth.uid();
  IF v_role = 'OWNER' THEN RETURN v_all; END IF;
  RETURN COALESCE(v_permissions, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_user_to_farm(
  p_farm_id UUID, p_email TEXT,
  p_role farm_role DEFAULT 'WORKER',
  p_permissions JSONB DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_target UUID;
  v_default JSONB := '{"dashboard":true,"expenses":true,"harvest":false,"capital":false,"debts":false,"inventory":false,"labor":false,"diary":true,"expense_categories":false,"withdraw":false}'::jsonb;
BEGIN
  IF NOT public.auth_is_system_admin() AND NOT public.auth_is_farm_owner(p_farm_id) THEN
    RETURN jsonb_build_object('error', 'Bạn không có quyền mời thành viên vào vườn này');
  END IF;
  SELECT id INTO v_target FROM auth.users WHERE email = p_email LIMIT 1;
  IF v_target IS NULL THEN
    RETURN jsonb_build_object('error', 'Không tìm thấy tài khoản với email: ' || p_email);
  END IF;
  INSERT INTO public.farm_members (farm_id, user_id, role, permissions, invited_by)
  VALUES (p_farm_id, v_target, p_role, COALESCE(p_permissions, v_default), auth.uid())
  ON CONFLICT (farm_id, user_id) DO UPDATE
    SET role = p_role, permissions = COALESCE(p_permissions, v_default);
  RETURN jsonb_build_object('success', true, 'user_id', v_target);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_farm_member_permissions(
  p_member_id UUID, p_permissions JSONB,
  p_role farm_role DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_farm_id UUID;
BEGIN
  SELECT farm_id INTO v_farm_id FROM public.farm_members WHERE id = p_member_id;
  IF NOT public.auth_is_system_admin() AND NOT public.auth_is_farm_owner(v_farm_id) THEN
    RETURN jsonb_build_object('error', 'Không có quyền');
  END IF;
  UPDATE public.farm_members
    SET permissions = p_permissions, role = COALESCE(p_role, role)
    WHERE id = p_member_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ==========================================
-- QLCN V9b: Fix harvest_seasons RLS & farm_id column
-- ==========================================

-- Ensure farm_id column exists on harvest_seasons
ALTER TABLE public.harvest_seasons
    ADD COLUMN IF NOT EXISTS farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE;

-- Re-create correct RLS policies for harvest_seasons
-- Members of a farm can see ALL seasons in that farm (not just seasons they created)
DROP POLICY IF EXISTS "Users can view own harvest_seasons" ON public.harvest_seasons;
DROP POLICY IF EXISTS "Users can insert own harvest_seasons" ON public.harvest_seasons;
DROP POLICY IF EXISTS "Users can update own harvest_seasons" ON public.harvest_seasons;
DROP POLICY IF EXISTS "Users can delete own harvest_seasons" ON public.harvest_seasons;
DROP POLICY IF EXISTS "harvest_seasons_select" ON public.harvest_seasons;
DROP POLICY IF EXISTS "harvest_seasons_insert" ON public.harvest_seasons;
DROP POLICY IF EXISTS "harvest_seasons_update" ON public.harvest_seasons;
DROP POLICY IF EXISTS "harvest_seasons_delete" ON public.harvest_seasons;

-- SELECT: farm member sees all seasons in their farm; fallback user_id for legacy rows
CREATE POLICY "harvest_seasons_select" ON public.harvest_seasons FOR SELECT USING (
    public.auth_is_system_admin()
    OR (farm_id IS NOT NULL AND public.auth_is_farm_member(farm_id))
    OR (farm_id IS NULL AND auth.uid() = user_id)
);

-- INSERT: must be farm member; user_id must match inserter
CREATE POLICY "harvest_seasons_insert" ON public.harvest_seasons FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (farm_id IS NULL OR public.auth_is_farm_member(farm_id) OR public.auth_is_system_admin())
);

-- UPDATE: any farm member can update seasons in their farm
CREATE POLICY "harvest_seasons_update" ON public.harvest_seasons FOR UPDATE USING (
    public.auth_is_system_admin()
    OR (farm_id IS NOT NULL AND public.auth_is_farm_member(farm_id))
    OR (farm_id IS NULL AND auth.uid() = user_id)
);

-- DELETE: only farm owner or system admin to prevent accidental deletion
CREATE POLICY "harvest_seasons_delete" ON public.harvest_seasons FOR DELETE USING (
    public.auth_is_system_admin()
    OR (farm_id IS NOT NULL AND public.auth_is_farm_owner(farm_id))
    OR (farm_id IS NULL AND auth.uid() = user_id)
);


-- ==========================================
-- QLCN V10: AI Chat History — Farm & Season Scoping
-- ==========================================

-- Add farm_id and season_id so chat history is isolated per farm + season
ALTER TABLE public.ai_chat_history
    ADD COLUMN IF NOT EXISTS farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES public.harvest_seasons(id) ON DELETE CASCADE;

-- Composite index for fast scoped queries
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_farm_season
    ON public.ai_chat_history(user_id, farm_id, season_id, created_at DESC);


-- ============================================================
-- QLCN V11: Comprehensive RLS Security Patch
-- Fixes: New users should NOT see farms/seasons they have no access to.
-- Also fixes: Invited members CAN see seasons they didn't create.
-- ============================================================

-- Re-apply FARMS RLS (membership-based)
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own farms" ON public.farms;
DROP POLICY IF EXISTS "Users can insert own farms" ON public.farms;
DROP POLICY IF EXISTS "Users can update own farms" ON public.farms;
DROP POLICY IF EXISTS "Users can delete own farms" ON public.farms;
DROP POLICY IF EXISTS "farms_select" ON public.farms;
DROP POLICY IF EXISTS "farms_insert" ON public.farms;
DROP POLICY IF EXISTS "farms_update" ON public.farms;
DROP POLICY IF EXISTS "farms_delete" ON public.farms;

CREATE POLICY "farms_select" ON public.farms FOR SELECT USING (
    public.auth_is_farm_member(id) OR public.auth_is_system_admin()
);
CREATE POLICY "farms_insert" ON public.farms FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "farms_update" ON public.farms FOR UPDATE USING (
    public.auth_is_farm_owner(id) OR public.auth_is_system_admin()
);
CREATE POLICY "farms_delete" ON public.farms FOR DELETE USING (
    public.auth_is_farm_owner(id) OR public.auth_is_system_admin()
);

-- Fix HARVEST_SEASONS RLS
ALTER TABLE public.harvest_seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own harvest_seasons" ON public.harvest_seasons;
DROP POLICY IF EXISTS "Users can insert own harvest_seasons" ON public.harvest_seasons;
DROP POLICY IF EXISTS "Users can update own harvest_seasons" ON public.harvest_seasons;
DROP POLICY IF EXISTS "Users can delete own harvest_seasons" ON public.harvest_seasons;
DROP POLICY IF EXISTS "harvest_seasons_select" ON public.harvest_seasons;
DROP POLICY IF EXISTS "harvest_seasons_insert" ON public.harvest_seasons;
DROP POLICY IF EXISTS "harvest_seasons_update" ON public.harvest_seasons;
DROP POLICY IF EXISTS "harvest_seasons_delete" ON public.harvest_seasons;

CREATE POLICY "harvest_seasons_select" ON public.harvest_seasons FOR SELECT USING (
    public.auth_is_system_admin()
    OR (farm_id IS NOT NULL AND public.auth_is_farm_member(farm_id))
    OR (farm_id IS NULL AND auth.uid() = user_id)
);
CREATE POLICY "harvest_seasons_insert" ON public.harvest_seasons FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (farm_id IS NULL OR public.auth_is_farm_member(farm_id) OR public.auth_is_system_admin())
);
CREATE POLICY "harvest_seasons_update" ON public.harvest_seasons FOR UPDATE USING (
    public.auth_is_system_admin()
    OR (farm_id IS NOT NULL AND public.auth_is_farm_member(farm_id))
    OR (farm_id IS NULL AND auth.uid() = user_id)
);
CREATE POLICY "harvest_seasons_delete" ON public.harvest_seasons FOR DELETE USING (
    public.auth_is_system_admin()
    OR (farm_id IS NOT NULL AND public.auth_is_farm_owner(farm_id))
    OR (farm_id IS NULL AND auth.uid() = user_id)
);


-- =====================================================
-- QLCN V12: Expense Activity Logs
-- =====================================================

CREATE TABLE IF NOT EXISTS public.expense_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    farm_id     UUID REFERENCES public.farms(id) ON DELETE CASCADE,
    season_id   UUID REFERENCES public.harvest_seasons(id) ON DELETE SET NULL,
    expense_id  UUID,                        -- NULL when deleted
    action      TEXT NOT NULL,               -- 'CREATE' | 'UPDATE' | 'DELETE'
    amount      NUMERIC,
    category    TEXT,
    description TEXT,
    meta        JSONB,                       -- extra diff info for UPDATE
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_logs_farm_season ON public.expense_logs(farm_id, season_id);
CREATE INDEX IF NOT EXISTS idx_expense_logs_user ON public.expense_logs(user_id);

ALTER TABLE public.expense_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_logs_select" ON public.expense_logs
    FOR SELECT USING (public.auth_is_farm_member(farm_id));

CREATE POLICY "expense_logs_insert" ON public.expense_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- =====================================================
-- QLCN V13: Account Lock Feature
-- =====================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_locked ON public.profiles(is_locked) WHERE is_locked = true;
