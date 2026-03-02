-- Function to get expense breakdown with filter (MONTH or SEASON)
-- Replaces the older month/year specific function to be more dynamic.

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
