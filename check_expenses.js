require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Fallback to environment variables if not found
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkExpenses() {
    console.log("Checking expenses table...");
    const { data, error } = await supabase
        .from('expenses')
        .select('id, amount, date, description, farm_id, season_id, user_id')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error fetching expenses:", error);
    } else {
        console.log("Found", data?.length || 0, "expenses:");
        console.dir(data, { depth: null });
    }
}

checkExpenses();
