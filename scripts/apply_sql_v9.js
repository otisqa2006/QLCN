import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    const sqlPath = path.resolve(__dirname, '../supabase/schema_update_v9_rbac.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Applying SQL migration for V9 RBAC...");

    const { data, error } = await supabase.from('expenses').select('id').limit(1);

    if (error) {
        console.error("Connection error:", error);
    } else {
        console.log("Connected to Supabase successfully.");
        console.log("=======================================");
        console.log("PLEASE RUN THE FOLLOWING SQL IN YOUR SUPABASE SQL EDITOR:");
        console.log("File:", sqlPath);
        console.log("=======================================");
        console.log(sql);
        console.log("=======================================");
        console.log("Since Supabase JS client cannot run raw DDL queries directly, it must be done via the dashboard.");
    }
}

applyMigration();
