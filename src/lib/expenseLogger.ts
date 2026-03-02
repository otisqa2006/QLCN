import { supabase } from './supabase';

export type ExpenseAction = 'CREATE' | 'UPDATE' | 'DELETE';

interface LogParams {
    userId: string;
    farmId?: string | null;
    seasonId?: string | null;
    expenseId?: string | null;
    action: ExpenseAction;
    amount?: number | null;
    category?: string | null;
    description?: string | null;
    meta?: Record<string, any>;
}

/**
 * Log an expense-related action (CREATE / UPDATE / DELETE) to expense_logs.
 * Fire-and-forget: swallows errors silently so it never blocks the main flow.
 */
export async function logExpenseAction(params: LogParams): Promise<void> {
    try {
        await supabase.from('expense_logs').insert({
            user_id: params.userId,
            farm_id: params.farmId ?? null,
            season_id: params.seasonId ?? null,
            expense_id: params.expenseId ?? null,
            action: params.action,
            amount: params.amount ?? null,
            category: params.category ?? null,
            description: params.description ?? null,
            meta: params.meta ?? null,
        });
    } catch (err) {
        console.warn('[expenseLogger] Failed to write log:', err);
    }
}
