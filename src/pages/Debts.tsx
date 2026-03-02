import { useState, useEffect } from 'react';
import { ReceiptText, CheckCircle2, ChevronRight, X, CreditCard, Banknote, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, formatCurrency } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFarmContext } from '../contexts/FarmContext';

export function Debts() {
    const { user } = useAuth();
    const { currentFarm, currentSeason } = useFarmContext();
    const navigate = useNavigate();
    const [loadingData, setLoadingData] = useState(true);
    const [debts, setDebts] = useState<any[]>([]);
    const [wallets, setWallets] = useState<any[]>([]);
    const [expenseFund, setExpenseFund] = useState<any>(null);

    const [selectedDebt, setSelectedDebt] = useState<any | null>(null);
    const [payAmount, setPayAmount] = useState<string>('');
    const [walletType, setWalletType] = useState<'BANK' | 'CASH'>('BANK');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchDebtsData = async () => {
        if (!user) return;
        setLoadingData(true);
        try {
            // 1. Fetch Wallets
            const { data: wals, error: walsError } = await supabase
                .from('wallets')
                .select('id, type')
                .eq('user_id', user.id);
            if (walsError) throw walsError;
            setWallets(wals || []);

            // 2. Fetch Fund
            const { data: fund, error: fundError } = await supabase
                .from('funds')
                .select('id')
                .eq('user_id', user.id)
                .eq('type', 'EXPENSE_FUND')
                .single();
            if (fundError && fundError.code !== 'PGRST116') throw fundError;
            setExpenseFund(fund);

            // 3. Fetch Debts with supplier name
            let query = supabase
                .from('debts')
                .select(`
                    id, 
                    description, 
                    total_amount, 
                    paid_amount, 
                    status,
                    suppliers ( name )
                `)
                .eq('user_id', user.id)
                .order('date', { ascending: false });

            if (currentFarm) query = query.eq('farm_id', currentFarm.id);
            if (currentSeason) query = query.eq('season_id', currentSeason.id);

            const { data: pendingDebts, error: debtsError } = await query;

            if (debtsError) throw debtsError;
            setDebts(pendingDebts || []);

        } catch (error) {
            console.error('Error fetching debts:', error);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        if (currentFarm && currentSeason) {
            fetchDebtsData();
        } else if (!currentFarm || !currentSeason) {
            setDebts([]);
        }
    }, [user, currentFarm, currentSeason]);

    const openPaymentModal = (debt: any) => {
        if (debt.status === 'DA_XONG') return;
        setSelectedDebt(debt);
        setPayAmount((debt.total_amount - debt.paid_amount).toString()); // Default to max
    };

    const handleSavePayment = async () => {
        const paymentNum = Number(payAmount);
        if (!paymentNum || paymentNum <= 0) {
            alert('Vui lòng nhập số tiền lớn hơn 0');
            return;
        }
        if (!selectedDebt || !expenseFund || wallets.length === 0) {
            alert('Dữ liệu hệ thống chưa sẵn sàng.');
            return;
        }

        const remainingToPay = selectedDebt.total_amount - selectedDebt.paid_amount;
        if (paymentNum > remainingToPay) {
            alert('Số tiền trả lớn hơn số tiền nợ!');
            return;
        }

        setIsSubmitting(true);
        try {
            const selectedWallet = wallets.find(w => w.type === walletType);
            if (!selectedWallet) throw new Error('Không tìm thấy ví tương ứng');

            const { error } = await supabase.from('debt_payments').insert({
                user_id: user?.id,
                debt_id: selectedDebt.id,
                wallet_id: selectedWallet.id,
                fund_id: expenseFund.id,
                amount: paymentNum
            });

            if (error) throw error;

            alert('Đã thanh toán nợ thành công!');
            setSelectedDebt(null);
            fetchDebtsData(); // Refresh list

        } catch (error: any) {
            console.error('Lỗi khi trả nợ:', error);
            alert('Lỗi: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const remainingToPay = selectedDebt ? (selectedDebt.total_amount - selectedDebt.paid_amount) : 0;

    if (loadingData) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4 pt-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <p className="text-slate-500 font-medium">Đang tải sổ nợ...</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6 flex flex-col h-full bg-slate-50 min-h-full pb-24 relative">
            <header className="mt-4 flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-slate-200/50 rounded-full text-slate-600 hover:bg-slate-300/50 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sổ Công Nợ</h1>
                    <p className="text-slate-500 text-sm mt-1">Danh sách nợ vật tư hiện tại</p>
                </div>
            </header>

            <div className="space-y-4">
                {debts.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-slate-200">
                        <p className="text-slate-500 font-medium whitespace-pre-wrap">Tuyệt vời!\nNhà vườn không có khoản nợ nào.</p>
                    </div>
                ) : debts.map(debt => {
                    const remaining = debt.total_amount - debt.paid_amount;
                    const isPaid = debt.status === 'DA_XONG';
                    const supplierName = debt.suppliers?.name || 'Đại lý không tên';

                    return (
                        <div
                            key={debt.id}
                            onClick={() => openPaymentModal(debt)}
                            className={cn(
                                "bg-white rounded-2xl p-4 shadow-sm border transition-all active:scale-[0.98]",
                                isPaid ? "border-emerald-100 opacity-70" : "border-slate-200 cursor-pointer hover:border-emerald-500/30"
                            )}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", isPaid ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600")}>
                                        {isPaid ? <CheckCircle2 className="w-5 h-5" /> : <ReceiptText className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-sm">{supplierName}</h3>
                                        <p className="text-xs text-slate-500 truncate max-w-[200px]">{debt.description}</p>
                                    </div>
                                </div>
                                {!isPaid && <ChevronRight className="w-5 h-5 text-slate-300" />}
                            </div>

                            <div className="flex justify-between items-end bg-slate-50 rounded-xl p-3">
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5">Tổng nợ</p>
                                    <p className="text-sm font-semibold text-slate-700">{formatCurrency(debt.total_amount)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-rose-500 uppercase tracking-wider font-bold mb-0.5">Còn nợ</p>
                                    <p className={cn("text-lg font-black tracking-tight", isPaid ? "text-emerald-500" : "text-rose-600")}>
                                        {formatCurrency(remaining)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Payment Bottom Sheet */}
            {selectedDebt && (
                <div className="fixed inset-0 z-[100] flex flex-col justify-end">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        onClick={() => setSelectedDebt(null)}
                    />

                    {/* Sheet */}
                    <div className="relative bg-white rounded-t-3xl shadow-2xl p-6 pt-2 pb-[calc(env(safe-area-inset-bottom)+2rem)] animate-in slide-in-from-bottom-full duration-300">
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-3" />

                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Thanh toán Nợ</h2>
                                <p className="text-slate-500 text-sm">{selectedDebt.suppliers?.name}</p>
                            </div>
                            <button
                                onClick={() => setSelectedDebt(null)}
                                className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 focus:outline-none"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="bg-rose-50 rounded-2xl p-4 mb-6 border border-rose-100">
                            <p className="text-sm text-rose-600/80 font-medium mb-1">Cần thanh toán tối đa</p>
                            <p className="text-3xl font-black text-rose-600">{formatCurrency(remainingToPay)}</p>
                        </div>

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Nhập số tiền trả đợt này (VNĐ)</label>
                                <input
                                    type="number"
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xl font-bold rounded-xl px-4 py-4 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:font-normal placeholder:text-slate-400"
                                    autoFocus
                                />
                            </div>

                            {/* Nguồn Tiền Toggle */}
                            <div className="flex p-1 bg-slate-100 rounded-xl space-x-1">
                                <button
                                    onClick={() => setWalletType('BANK')}
                                    className={cn(
                                        'flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold rounded-lg transition-all',
                                        walletType === 'BANK' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:bg-slate-200/50'
                                    )}
                                >
                                    <CreditCard className="w-4 h-4" />
                                    Trừ Bank
                                </button>
                                <button
                                    onClick={() => setWalletType('CASH')}
                                    className={cn(
                                        'flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold rounded-lg transition-all',
                                        walletType === 'CASH' ? 'bg-white shadow text-amber-600' : 'text-slate-500 hover:bg-slate-200/50'
                                    )}
                                >
                                    <Banknote className="w-4 h-4" />
                                    Tiền Mặt
                                </button>
                            </div>

                            <button
                                onClick={handleSavePayment}
                                disabled={isSubmitting}
                                className="w-full flex justify-center items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-slate-900/30 transition-all active:scale-[0.98] mt-2 disabled:opacity-70"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Xác nhận Trả Nợ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
