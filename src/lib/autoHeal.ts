import { supabase } from './supabase';

export async function ensureUserSystemData(userId: string) {
    try {
        // 1. Ensure Wallets (BANK and CASH)
        const { data: wallets } = await supabase.from('wallets').select('id').eq('user_id', userId);
        if (!wallets || wallets.length === 0) {
            console.log('Auto-healing: Creating missing wallets for user', userId);
            await supabase.from('wallets').insert([
                { user_id: userId, type: 'BANK' },
                { user_id: userId, type: 'CASH' }
            ]);
        }

        // 2. Ensure Funds (TOTAL_CAPITAL and EXPENSE_FUND)
        const { data: funds } = await supabase.from('funds').select('id, type').eq('user_id', userId);

        const hasTotalCapital = funds?.some(f => f.type === 'TOTAL_CAPITAL');
        const hasExpenseFund = funds?.some(f => f.type === 'EXPENSE_FUND');

        if (!hasTotalCapital || !hasExpenseFund) {
            console.log('Auto-healing: Creating missing funds for user', userId);
            const fundsToInsert = [];
            if (!hasTotalCapital) fundsToInsert.push({ user_id: userId, type: 'TOTAL_CAPITAL' });
            if (!hasExpenseFund) fundsToInsert.push({ user_id: userId, type: 'EXPENSE_FUND' });

            if (fundsToInsert.length > 0) {
                await supabase.from('funds').insert(fundsToInsert);
            }
        }

    } catch (error) {
        console.error('Error auto-healing user data:', error);
    }
}
