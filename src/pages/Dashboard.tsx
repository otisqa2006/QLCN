import { useState, useEffect } from 'react';
import {
    WalletCards, Landmark, Receipt, Loader2,
    AlertTriangle, Leaf, CalendarCheck, TrendingUp
} from 'lucide-react';
import { cn, formatNumber, formatCurrency } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFarmContext } from '../contexts/FarmContext';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

export function Dashboard() {
    const { user } = useAuth();
    const { currentFarm, currentSeason } = useFarmContext();
    const [loading, setLoading] = useState(true);

    // Data States
    const [financialSummary, setFinancialSummary] = useState<any>(null);
    const [expenseBreakdown, setExpenseBreakdown] = useState<any[]>([]);
    const [expenseFilter, setExpenseFilter] = useState<'MONTH' | 'SEASON'>('MONTH');
    const d = new Date();
    const [selectedMonth, setSelectedMonth] = useState(d.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(d.getFullYear());
    const [harvestVsCost, setHarvestVsCost] = useState<any>(null);
    const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([]);
    const [plotStatus, setPlotStatus] = useState<any[]>([]);

    useEffect(() => {
        if (!user || !currentFarm || !currentSeason) return;

        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                // Financial Summary
                const { data: finData } = await supabase.rpc('get_financial_summary', { p_user_id: user.id });
                if (finData && finData.length > 0) setFinancialSummary(finData[0]);

                // Expense Breakdown — filtered by farm + season/month
                const { data: expData, error: expError } = await supabase.rpc('get_expense_breakdown', {
                    p_user_id: user.id,
                    p_filter_type: expenseFilter,
                    p_farm_id: currentFarm.id,
                    p_season_id: expenseFilter === 'SEASON' ? currentSeason.id : null,
                    p_month: expenseFilter === 'MONTH' ? selectedMonth : null,
                    p_year: expenseFilter === 'MONTH' ? selectedYear : null,
                });
                if (expError) console.error('Error fetching expense breakdown:', expError);
                else if (expData) setExpenseBreakdown(expData);

                // Harvest vs Cost
                const { data: harvData } = await supabase.rpc('get_harvest_vs_cost', { p_user_id: user.id });
                if (harvData && harvData.length > 0) setHarvestVsCost(harvData[0]);

                // Low Stock Alerts
                const { data: alertData } = await supabase.rpc('get_low_stock_alerts', { p_user_id: user.id });
                if (alertData) setLowStockAlerts(alertData);

                // Plot Status
                const { data: plotData } = await supabase.rpc('get_plot_status', { p_user_id: user.id });
                if (plotData) setPlotStatus(plotData);

            } catch (error) {
                console.error('Error fetching dashboard RPC data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [user, currentFarm, currentSeason, expenseFilter, selectedMonth, selectedYear]);


    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    // Prepare Chart Data
    const pieData = expenseBreakdown.length > 0 ? expenseBreakdown : [{ category_name: 'Chưa có dữ liệu', total_amount: 1, color_code: '#cbd5e1' }];

    const profitData = harvestVsCost ? [
        { name: 'Chi phí', amount: Number(harvestVsCost.total_cost || 0), fill: '#f43f5e' }, // Rose-500
        { name: 'Doanh thu', amount: Number(harvestVsCost.total_revenue || 0), fill: '#10b981' } // Emerald-500
    ] : [];

    const totalCapital = Number(financialSummary?.total_capital || 0);
    const totalBank = Number(financialSummary?.total_bank || 0);
    const totalCash = Number(financialSummary?.total_cash || 0);

    // Áp dụng định nghĩa mới: 
    // - Quỹ Chi Tiêu (Bank+Mặt) = Số tiền đã rút ra (EXPENSE_FUND)
    // - Tổng Tiền = Tổng Vốn + Quỹ Chi Tiêu
    const totalExpenseFund = Number(financialSummary?.total_expense_fund || 0);
    const totalCurrentMoney = totalCapital + totalExpenseFund;
    const totalLoans = Number(financialSummary?.total_loans || 0);

    const cards = [
        {
            title: 'Tổng Tiền (Vốn + Quỹ)',
            amount: totalCurrentMoney,
            icon: Landmark,
            color: 'bg-emerald-500',
            textColor: 'text-emerald-500',
            bgLight: 'bg-emerald-50',
        },
        {
            title: 'Tổng Vốn (Chưa rút)',
            amount: totalCapital,
            icon: Landmark,
            color: 'bg-indigo-500',
            textColor: 'text-indigo-500',
            bgLight: 'bg-indigo-50',
        },
        {
            title: 'Quỹ Chi Tiêu (Bank+Mặt)',
            amount: totalExpenseFund,
            icon: WalletCards,
            color: 'bg-amber-500',
            textColor: 'text-amber-500',
            bgLight: 'bg-amber-50',
            subtitle: `Bank: ${(totalBank / 1000000).toFixed(1)}tr | Tiền mặt: ${(totalCash / 1000000).toFixed(1)}tr`
        },
        {
            title: 'Tổng Tiền Vay',
            amount: totalLoans,
            icon: Receipt,
            color: 'bg-rose-500',
            textColor: 'text-rose-500',
            bgLight: 'bg-rose-50',
        }
    ];

    return (
        <div className="p-4 space-y-6 pb-24 h-full overflow-y-auto bg-slate-50">
            <header className="mt-4">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Thống Kê Vườn</h1>
                <p className="text-slate-500 text-sm mt-1">Tổng quan tài chính & Nông vụ</p>
            </header>

            {/* Cảnh báo đỏ (Low Stock & Debt) */}
            {lowStockAlerts.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-2 text-rose-700 font-bold mb-3">
                        <AlertTriangle className="w-5 h-5" />
                        <span>Vật tư sắp hết hạn / Cạn kho</span>
                    </div>
                    <div className="space-y-2">
                        {lowStockAlerts.map(item => (
                            <div key={item.item_id} className="flex justify-between items-center text-sm bg-white p-3 rounded-xl border border-rose-100">
                                <span className="font-semibold text-slate-800">{item.item_name}</span>
                                <span className="font-bold text-rose-600 bg-rose-100 px-2 py-1 rounded">
                                    Còn: {item.stock_quantity} {item.unit}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cards 2x2 */}
            <div className="grid grid-cols-2 gap-3">
                {cards.map((card, idx) => (
                    <div
                        key={idx}
                        className={cn(
                            'rounded-3xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between aspect-[4/3]',
                            card.bgLight
                        )}
                    >
                        <div className="flex items-start justify-between mb-2">
                            <div className={cn('p-2 rounded-xl bg-white bg-opacity-60 backdrop-blur-sm', card.textColor)}>
                                <card.icon className="w-5 h-5" strokeWidth={2.5} />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-500/80 mb-0.5 mt-1">
                                {card.title}
                            </h2>
                            <p className={cn('text-lg font-black tracking-tight leading-none', card.textColor)}>
                                {formatNumber(card.amount)} <span className="text-[10px] font-bold leading-none align-top">đ</span>
                            </p>
                            {card.subtitle && (
                                <p className="text-[9px] font-semibold text-slate-500 mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
                                    {card.subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Chi Tiêu Tháng (Pie Chart) */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="font-bold text-slate-800">Cơ cấu Chi tiêu</h3>
                        <p className="text-xs text-slate-400 mt-1">Các khoản chi chính ảnh hưởng đến lợi nhuận</p>
                    </div>
                    {/* Toggle Month/Season */}
                    <div className="flex bg-slate-100 rounded-lg p-1">
                        <button
                            onClick={() => setExpenseFilter('MONTH')}
                            className={cn(
                                "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                                expenseFilter === 'MONTH' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            Theo tháng
                        </button>
                        <button
                            onClick={() => setExpenseFilter('SEASON')}
                            className={cn(
                                "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                                expenseFilter === 'SEASON' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            Theo vụ
                        </button>
                    </div>
                </div>

                {expenseFilter === 'MONTH' && (
                    <div className="mb-4 flex justify-center">
                        <div className="flex bg-slate-100/80 rounded-xl px-3 py-1.5 items-center border border-slate-200">
                            <select
                                value={selectedMonth}
                                onChange={e => setSelectedMonth(Number(e.target.value))}
                                className="bg-transparent text-slate-700 text-sm font-bold pl-1 outline-none cursor-pointer appearance-none text-center"
                            >
                                {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>)}
                            </select>
                            <span className="text-slate-300 font-bold mx-2">/</span>
                            <select
                                value={selectedYear}
                                onChange={e => setSelectedYear(Number(e.target.value))}
                                className="bg-transparent text-slate-700 text-sm font-bold pr-1 outline-none cursor-pointer appearance-none text-center"
                            >
                                {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                <div className="mb-4 text-center">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Tổng {expenseFilter === 'MONTH' ? `Tháng ${selectedMonth}/${selectedYear}` : 'Vụ này'}
                    </p>
                    <p className="text-3xl font-black text-rose-500 tracking-tight">
                        {formatCurrency(expenseBreakdown.reduce((sum, item) => sum + Number(item.total_amount), 0))}
                    </p>
                </div>

                <div className="h-[200px] w-full mb-2 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="total_amount"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color_code || '#cbd5e1'} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: any) => [formatCurrency(value), ''] as any}
                                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Custom Legend */}
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    {expenseBreakdown.map(exp => (
                        <div key={exp.category_name} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: exp.color_code }}></div>
                            <span className="truncate text-slate-600 font-medium">{exp.category_name}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tiến độ Mùa vụ (Plot Status) */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                    <Leaf className="w-5 h-5 text-emerald-500" />
                    <h3 className="font-bold text-slate-800">Tiến độ Nông vụ</h3>
                </div>

                <div className="space-y-3">
                    {plotStatus.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center italic">Chưa có lô đất nào được ghi nhận</p>
                    ) : plotStatus.map(plot => (
                        <div key={plot.plot_id} className="flex flex-col p-3 rounded-2xl bg-slate-50 border border-slate-100">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-slate-900">{plot.plot_name}</span>
                                <span className="text-[10px] font-bold uppercase bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md">
                                    {plot.tree_count} {plot.tree_type}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <CalendarCheck className="w-4 h-4 text-emerald-500" />
                                {plot.last_action ? (
                                    <span>Gần nhất: <b>{new Date(plot.last_action_date).toLocaleDateString()}</b> ({plot.last_action})</span>
                                ) : (
                                    <span className="italic">Chưa có hoạt động chăm sóc</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Đầu tư & Lợi nhuận (Bar Chart) */}
            <div className="bg-slate-900 rounded-3xl p-5 shadow-xl text-white">
                <div className="flex items-center gap-2 mb-6">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-white">Hiệu quả Đầu tư</h3>
                </div>

                <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={profitData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                            <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} tickFormatter={(val) => `${val / 1000000}tr`} axisLine={false} tickLine={false} />
                            <Tooltip
                                cursor={{ fill: '#1e293b' }}
                                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '1rem', border: '1px solid #334155' }}
                                formatter={(value: any) => [formatCurrency(value), ''] as any}
                            />
                            <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={60} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {harvestVsCost && (
                    <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-end">
                        <span className="text-sm font-medium text-slate-400">Lãi gộp ước tính</span>
                        <span className={cn(
                            "text-2xl font-black tracking-tight",
                            Number(harvestVsCost.profit) >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}>
                            {formatCurrency(harvestVsCost.profit)}
                        </span>
                    </div>
                )}
            </div>

        </div>
    );
}
