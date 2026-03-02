import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFarmContext } from '../contexts/FarmContext';
import { Loader2, Trash2, Edit2, CheckSquare, Square, X, Search, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, formatCurrency } from '../lib/utils';
import { logExpenseAction } from '../lib/expenseLogger';
// Fallback local icon map
// It's cleaner to duplicate the small map here for now to avoid circular dependencies
import { Droplet, Bug, Scissors, Users, Utensils, Fuel, MoreHorizontal, Zap, ShoppingCart, Wrench } from 'lucide-react';
const iconMap: Record<string, any> = { Droplet, Bug, Scissors, Users, Utensils, Fuel, MoreHorizontal, Zap, ShoppingCart, Wrench };
const getLocalCategoryIcon = (cat: any) => {
    if (cat?.icon_name && iconMap[cat.icon_name]) return iconMap[cat.icon_name];
    return MoreHorizontal;
};

export function ExpenseList() {
    const { user } = useAuth();
    const { currentFarm, currentSeason } = useFarmContext();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [wallets, setWallets] = useState<any[]>([]);

    // Filters
    const d = new Date();
    const [month, setMonth] = useState(d.getMonth() + 1);
    const [year, setYear] = useState(d.getFullYear());
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

    // Selections
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Edit Modal
    const [editingExpense, setEditingExpense] = useState<any>(null);
    const [editAmount, setEditAmount] = useState<string>('');
    const [editDate, setEditDate] = useState<string>('');
    const [editCategoryId, setEditCategoryId] = useState<string>('');
    const [editWalletId, setEditWalletId] = useState<string>('');
    const [editNotes, setEditNotes] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!user || !currentFarm || !currentSeason) return;
        fetchData();
    }, [user, currentFarm, currentSeason, month, year]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Categories for Filter/Edit
            const { data: cats } = await supabase.from('expense_categories').select('*').eq('user_id', user?.id).order('name');
            if (cats) setCategories(cats);

            // 2. Fetch Wallets for Edit
            const { data: wals } = await supabase.from('wallets').select('*').eq('user_id', user?.id);
            if (wals) setWallets(wals);

            // 3. Fetch Expenses based on month/year
            // Month ranges (Local Timezone safe)
            const dStart = new Date(year, month - 1, 1);
            const dEnd = new Date(year, month, 0);

            // Format to YYYY-MM-DD safely
            const startDate = `${dStart.getFullYear()}-${String(dStart.getMonth() + 1).padStart(2, '0')}-${String(dStart.getDate()).padStart(2, '0')}`;
            const endDate = `${dEnd.getFullYear()}-${String(dEnd.getMonth() + 1).padStart(2, '0')}-${String(dEnd.getDate()).padStart(2, '0')}`;

            let query = supabase
                .from('expenses')
                .select(`
                    id, amount, description, date,
                    category_id, wallet_id, fund_id, farm_id, season_id, is_archived,
                    expense_categories ( id, name, icon_name, color_code ),
                    wallets ( id, type )
                `)
                .eq('user_id', user?.id)
                .eq('farm_id', currentFarm?.id)
                .eq('season_id', currentSeason?.id)
                .is('is_archived', false) // Use is(false) to catch actual false values
                // Also handle NULLs by appending or() later if needed, but since we ALTER TABLE with DEFAULT false, it should cover new rows.
                // For old rows, we'll use an OR condition to be safe.
                .or('is_archived.is.null,is_archived.eq.false')
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;
            setExpenses(data || []);
            setSelectedIds(new Set()); // Reset selections on fetch

        } catch (error: any) {
            console.error('Error fetching expenses:', error.message);
        } finally {
            setLoading(false);
        }
    };

    // Derived Filtered List based on client-side Category filter
    const filteredExpenses = expenses.filter(exp => {
        if (selectedCategory !== 'ALL' && exp.category_id !== selectedCategory) return false;
        return true;
    });

    const totalFilteredAmount = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

    // Group expenses by date
    const groupedExpenses = filteredExpenses.reduce((acc, exp) => {
        const dateStr = exp.date;
        if (!acc[dateStr]) {
            acc[dateStr] = {
                dateFormatted: new Date(exp.date).toLocaleDateString('vi-VN'),
                total: 0,
                items: []
            };
        }
        acc[dateStr].items.push(exp);
        acc[dateStr].total += Number(exp.amount);
        return acc;
    }, {} as Record<string, { dateFormatted: string, total: number, items: any[] }>);

    const sortedDates = Array.from(new Set(filteredExpenses.map(e => e.date)));

    // Handlers
    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredExpenses.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredExpenses.map(e => e.id)));
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Bạn có chắc muốn xoá ${selectedIds.size} giao dịch đã chọn? Dòng tiền sẽ được hoàn lại vào quỹ tương ứng.`)) return;

        try {
            // Capture expense data before deleting for log
            const toDelete = filteredExpenses.filter(e => selectedIds.has(e.id));

            const { error } = await supabase
                .from('expenses')
                .delete()
                .in('id', Array.from(selectedIds));

            if (error) throw error;

            // Log each deleted expense (fire-and-forget)
            toDelete.forEach(exp => {
                logExpenseAction({
                    userId: user!.id,
                    farmId: currentFarm?.id,
                    seasonId: currentSeason?.id,
                    expenseId: exp.id,
                    action: 'DELETE',
                    amount: exp.amount,
                    category: exp.expense_categories?.name ?? null,
                    description: exp.description ?? null,
                });
            });

            alert('Đã xoá thành công!');
            fetchData();
        } catch (error: any) {
            alert('Lỗi xoá giao dịch: ' + error.message);
        }
    };

    // Edit Logic
    const openEdit = (exp: any) => {
        setEditingExpense(exp);
        setEditAmount((exp.amount / 1000).toString()); // Keep formatting simple for edit
        setEditDate(exp.date);
        setEditCategoryId(exp.category_id);
        setEditWalletId(exp.wallet_id);
        setEditNotes(exp.description || '');
    };

    const handleSaveEdit = async () => {
        const actualAmount = Number(editAmount.replace(/\D/g, '')) * 1000;
        if (!actualAmount || actualAmount <= 0) return alert('Số tiền không hợp lệ');

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('expenses')
                .update({
                    amount: actualAmount,
                    date: editDate,
                    category_id: editCategoryId,
                    wallet_id: editWalletId,
                    description: editNotes.trim() || null
                })
                .eq('id', editingExpense.id);

            if (error) throw error;

            // Log the UPDATE action (fire-and-forget)
            const selectedCat = categories.find(c => c.id === editCategoryId);
            logExpenseAction({
                userId: user!.id,
                farmId: currentFarm?.id,
                seasonId: currentSeason?.id,
                expenseId: editingExpense.id,
                action: 'UPDATE',
                amount: actualAmount,
                category: selectedCat?.name ?? null,
                description: editNotes.trim() || null,
                meta: {
                    old_amount: editingExpense.amount,
                    old_date: editingExpense.date,
                    new_date: editDate,
                },
            });

            alert('Đã cập nhật thành công!');
            setEditingExpense(null);
            fetchData();
        } catch (error: any) {
            alert('Lỗi cập nhật: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-y-auto pb-[120px]">
            {/* === COMPACT HEADER === */}
            <header className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between sticky top-0 z-40">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-slate-800">Lịch sử chi</h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Tổng tháng</p>
                        <p className="text-sm font-black text-rose-500">{formatCurrency(totalFilteredAmount)}</p>
                    </div>
                    <button
                        onClick={() => navigate('/expenses')}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-full shadow-sm transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* === FILTERS === */}
            <div className="px-4 py-3 bg-white shadow-sm border-b border-slate-100 flex flex-wrap gap-3 select-none sticky top-[60px] z-30 shrink-0">
                {/* Month/Year */}
                <div className="flex bg-slate-100/80 rounded-xl px-2 py-1.5 shrink-0 items-center border border-slate-200">
                    <select
                        value={month}
                        onChange={e => setMonth(Number(e.target.value))}
                        className="bg-transparent text-slate-700 text-xs font-bold pl-1 outline-none cursor-pointer appearance-none text-center"
                    >
                        {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>)}
                    </select>
                    <span className="text-slate-300 font-bold mx-1">/</span>
                    <select
                        value={year}
                        onChange={e => setYear(Number(e.target.value))}
                        className="bg-transparent text-slate-700 text-xs font-bold pr-1 outline-none cursor-pointer appearance-none text-center"
                    >
                        {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>

                {/* Category */}
                <div className="flex bg-slate-100/80 rounded-xl flex-1 min-w-[140px] px-2 py-1.5 border border-slate-200">
                    <select
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value)}
                        className="bg-transparent text-slate-700 text-xs font-bold outline-none w-full cursor-pointer appearance-none truncate text-center"
                    >
                        <option value="ALL">Tất cả danh mục</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </div>

            {/* === BATCH ACTION BAR (FLOATING) === */}
            <div className={cn(
                "fixed bottom-[80px] left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-slate-900 text-white p-3 rounded-2xl shadow-xl flex items-center justify-between z-50 transition-all duration-300",
                selectedIds.size > 0 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
            )}>
                <span className="font-bold text-sm pl-2">Đã chọn ({selectedIds.size})</span>
                <button
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-1 bg-rose-500 hover:bg-rose-600 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                >
                    <Trash2 className="w-4 h-4" /> Xoá
                </button>
            </div>

            {/* LIST */}
            <div className="p-4 space-y-3">
                {loading ? (
                    <div className="py-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
                ) : filteredExpenses.length === 0 ? (
                    <div className="py-10 text-center text-slate-400">
                        <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">Không tìm thấy giao dịch nào</p>
                    </div>
                ) : (
                    <>
                        {/* Summary Bar for selection */}
                        <div className="flex items-center gap-2 mb-2 px-1">
                            <button onClick={toggleSelectAll} className="text-slate-400 hover:text-emerald-500 p-1">
                                {selectedIds.size === filteredExpenses.length && filteredExpenses.length > 0 ? (
                                    <CheckSquare className="w-5 h-5 text-emerald-500" />
                                ) : (
                                    <Square className="w-5 h-5" />
                                )}
                            </button>
                            <span className="text-xs font-bold text-slate-400 uppercase">Chọn tất cả</span>
                        </div>

                        {sortedDates.map((dateStr) => {
                            const group = groupedExpenses[dateStr];
                            return (
                                <div key={dateStr} className="space-y-3 mt-4 first:mt-0">
                                    <div className="flex items-center justify-between px-1">
                                        <h3 className="font-bold text-slate-700 text-sm bg-slate-200/50 px-3 py-1 rounded-full">{group.dateFormatted}</h3>
                                        <span className="text-xs font-black text-rose-500 bg-rose-50 px-3 py-1 rounded-full">-{formatCurrency(group.total)}</span>
                                    </div>

                                    {group.items.map((exp: any) => {
                                        const isSelected = selectedIds.has(exp.id);
                                        const IconC = getLocalCategoryIcon(exp.expense_categories);
                                        const catColor = exp.expense_categories?.color_code || '#64748b';

                                        return (
                                            <div
                                                key={exp.id}
                                                className={cn(
                                                    "relative overflow-hidden bg-white p-4 rounded-2xl shadow-sm border transition-all flex items-center gap-3",
                                                    isSelected ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-100"
                                                )}
                                            >
                                                {/* Wallet Type Color Indicator */}
                                                <div className={cn(
                                                    "absolute left-0 top-0 bottom-0 w-1.5",
                                                    exp.wallets?.type === 'CASH' ? 'bg-amber-400' : 'bg-blue-500'
                                                )} />

                                                <button onClick={() => toggleSelect(exp.id)} className="flex-shrink-0 text-slate-300 hover:text-emerald-500 z-10 ml-1">
                                                    {isSelected ? <CheckSquare className="w-6 h-6 text-emerald-500" /> : <Square className="w-6 h-6" />}
                                                </button>

                                                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10" style={{ backgroundColor: `${catColor}20`, color: catColor }}>
                                                    <IconC className="w-5 h-5" />
                                                </div>

                                                <div className="flex-1 min-w-0 z-10" onClick={() => openEdit(exp)}>
                                                    <h3 className="font-bold text-slate-800 text-sm truncate">
                                                        {exp.description ? exp.description : (exp.expense_categories?.name || 'Không rõ')}
                                                    </h3>
                                                    {exp.description && (
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                                                            {exp.expense_categories?.name || 'Không rõ'}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="text-right flex flex-col justify-center items-end z-10" onClick={() => openEdit(exp)}>
                                                    <p className="font-black text-slate-800 text-base">-{formatCurrency(exp.amount)}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </>
                )}
            </div>

            {/* === EDIT MODAL === */}
            {editingExpense && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8">
                        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                            <h2 className="font-bold text-lg text-slate-800">Sửa Khoản Chi</h2>
                            <button onClick={() => setEditingExpense(null)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 hover:text-rose-500 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
                            {/* Amount */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Số tiền (k)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={editAmount}
                                        onChange={e => setEditAmount(e.target.value)}
                                        className="w-full bg-slate-100 text-slate-800 text-lg font-black px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">.000 đ</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {/* Date */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Ngày</label>
                                    <input
                                        type="date"
                                        value={editDate}
                                        onChange={e => setEditDate(e.target.value)}
                                        className="w-full bg-slate-100 text-slate-800 text-sm font-bold px-3 py-3 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    />
                                </div>
                                {/* Wallet */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Nguồn tiền</label>
                                    <select
                                        value={editWalletId}
                                        onChange={e => setEditWalletId(e.target.value)}
                                        className="w-full bg-slate-100 text-slate-800 text-sm font-bold px-3 py-3 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    >
                                        {wallets.map(w => <option key={w.id} value={w.id}>{w.type === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Danh mục</label>
                                <select
                                    value={editCategoryId}
                                    onChange={e => setEditCategoryId(e.target.value)}
                                    className="w-full bg-slate-100 text-slate-800 text-sm font-bold px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50"
                                >
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Ghi chú</label>
                                <textarea
                                    value={editNotes}
                                    onChange={e => setEditNotes(e.target.value)}
                                    rows={2}
                                    className="w-full bg-slate-100 text-slate-800 text-sm font-medium px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                                />
                            </div>

                            <button
                                onClick={handleSaveEdit}
                                disabled={isSaving}
                                className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex justify-center items-center gap-2"
                            >
                                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Edit2 className="w-5 h-5" /> Lưu Thay Đổi</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
