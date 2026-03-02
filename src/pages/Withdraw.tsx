import { useState, useEffect, useRef } from 'react';
import { Landmark, ArrowDownCircle, CreditCard, Banknote, Loader2, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { cn, formatNumber } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function Withdraw() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [loadingData, setLoadingData] = useState(true);
    const [wallets, setWallets] = useState<any[]>([]);
    const [totalCapitalFund, setTotalCapitalFund] = useState<any>(null);
    const [expenseFund, setExpenseFund] = useState<any>(null);

    const [walletType, setWalletType] = useState<'BANK' | 'CASH'>('BANK');
    const [displayAmount, setDisplayAmount] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showToast, setShowToast] = useState(false);

    const amountInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            try {
                // Fetch Wallets
                const { data: wals, error: walsError } = await supabase
                    .from('wallets')
                    .select('*')
                    .eq('user_id', user.id);
                if (walsError) throw walsError;
                setWallets(wals || []);

                // Fetch Funds
                const { data: funds, error: fundsError } = await supabase
                    .from('funds')
                    .select('*')
                    .eq('user_id', user.id);
                if (fundsError) throw fundsError;

                setTotalCapitalFund(funds?.find(f => f.type === 'TOTAL_CAPITAL') || null);
                setExpenseFund(funds?.find(f => f.type === 'EXPENSE_FUND') || null);

            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setLoadingData(false);
            }
        };

        fetchData();

        setTimeout(() => {
            if (amountInputRef.current) amountInputRef.current.focus();
        }, 300);
    }, [user]);

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, '');
        if (!raw) {
            setDisplayAmount('');
            return;
        }
        setDisplayAmount(new Intl.NumberFormat('vi-VN').format(Number(raw)));
    };

    const actualAmountStr = displayAmount.replace(/\D/g, '');
    const actualAmount = actualAmountStr ? Number(actualAmountStr) * 1000 : 0;

    const currentCapital = Number(totalCapitalFund?.balance || 0);

    const handleWithdraw = async () => {
        if (!actualAmount || actualAmount <= 0) {
            alert('Vui lòng nhập số tiền hợp lệ.');
            return;
        }
        if (actualAmount > currentCapital) {
            alert('Số tiền rút vượt quá Tổng vốn hiện có.');
            return;
        }
        if (!totalCapitalFund || !expenseFund || wallets.length === 0) {
            alert('Lỗi hệ thống: Chưa khởi tạo đủ quỹ.');
            return;
        }

        setIsSubmitting(true);
        try {
            const selectedWallet = wallets.find(w => w.type === walletType);
            if (!selectedWallet) throw new Error('Không tìm thấy ví đã chọn.');

            const { error } = await supabase.from('fund_transfers').insert({
                user_id: user?.id,
                from_fund_id: totalCapitalFund.id,
                to_fund_id: expenseFund.id,
                to_wallet_id: selectedWallet.id,
                amount: actualAmount,
                description: notes.trim() || 'Rút tiền chi tiêu',
                date: new Date().toISOString().split('T')[0]
            });

            if (error) throw error;

            // Reduce local state optimistically
            setTotalCapitalFund((prev: any) => ({ ...prev, balance: Number(prev.balance) - actualAmount }));

            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);

            setDisplayAmount('');
            setNotes('');

        } catch (error: any) {
            alert('Lỗi: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loadingData) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4 pt-20 bg-slate-50 text-indigo-600">
                <Loader2 className="w-10 h-10 animate-spin" />
                <p className="font-bold tracking-widest uppercase text-sm">Đang tải biểu mẫu...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-y-auto pb-[120px]">
            {/* COMPACT HEADER */}
            <header className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-1">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-800">Rút vốn chi tiêu</h1>
                </div>
            </header>

            <div className="px-4 pt-6 space-y-6 max-w-lg mx-auto w-full">

                {/* CAPITAL BALANCE CARD */}
                <div className="bg-indigo-500 rounded-3xl p-5 shadow-lg text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Landmark className="w-24 h-24" />
                    </div>
                    <div className="relative z-10 flex flex-col">
                        <span className="text-indigo-100 text-sm font-semibold uppercase tracking-wider mb-1">
                            Tổng vốn khả dụng
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black tracking-tight">{formatNumber(currentCapital)}</span>
                            <span className="text-sm font-bold opacity-80">đ</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center -my-3 relative z-10">
                    <div className="bg-white p-2 rounded-full shadow-md border border-slate-100 text-indigo-500">
                        <ArrowDownCircle className="w-6 h-6" />
                    </div>
                </div>

                {/* TARGET WALLET */}
                <div className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-500 mb-3 text-xs uppercase tracking-wider">Chuyển về Quỹ Chi Tiêu</h3>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setWalletType('BANK')}
                            className={cn(
                                "flex-1 p-3 rounded-2xl flex flex-col items-center justify-center gap-2 font-bold transition-all border-2",
                                walletType === 'BANK' ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-100 bg-slate-50 text-slate-500 opacity-60 hover:opacity-100"
                            )}
                        >
                            <CreditCard className="w-5 h-5 mb-1" />
                            <span>Chuyển Khoản</span>
                        </button>

                        <button
                            onClick={() => setWalletType('CASH')}
                            className={cn(
                                "flex-1 p-3 rounded-2xl flex flex-col items-center justify-center gap-2 font-bold transition-all border-2",
                                walletType === 'CASH' ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-100 bg-slate-50 text-slate-500 opacity-60 hover:opacity-100"
                            )}
                        >
                            <Banknote className="w-5 h-5 mb-1" />
                            <span>Tiền Mặt</span>
                        </button>
                    </div>
                </div>

                {/* AMOUNT INPUT */}
                <div className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-100 text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Số tiền cần rút</p>
                    <div className="relative inline-flex flex-col items-center justify-center group w-full mb-2">
                        <input
                            ref={amountInputRef}
                            type="text"
                            inputMode="numeric"
                            value={displayAmount}
                            onChange={handleAmountChange}
                            className="absolute inset-0 w-full h-[60px] opacity-0 cursor-text z-20 caret-transparent"
                            placeholder="0"
                        />
                        <div className={cn(
                            "flex items-baseline justify-center text-5xl font-black transition-colors border-b-2 pb-1 border-indigo-500/30 group-focus-within:border-indigo-500",
                            displayAmount ? "text-slate-800" : "text-slate-300"
                        )}>
                            <span>{displayAmount || '0'}</span>
                            {displayAmount && <span className="text-indigo-500">.000</span>}
                            <span className="text-2xl text-slate-400 ml-1">đ</span>
                        </div>
                    </div>
                </div>

                {/* NOTES */}
                <div className="bg-white rounded-[1.5rem] p-4 shadow-sm border border-slate-100 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight mb-2">Ghi Chú Rút Tiền</p>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="VD: Rút tiền chuẩn bị mua phân bón..."
                        rows={2}
                        className="w-full text-base font-medium text-slate-800 bg-transparent outline-none resize-none placeholder:text-slate-300"
                    />
                </div>

                {/* SUBMIT BUTTON */}
                <div className="pt-2 pb-8">
                    <button
                        onClick={handleWithdraw}
                        disabled={isSubmitting || actualAmount <= 0 || actualAmount > currentCapital}
                        className="w-full flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-lg py-4 rounded-2xl shadow-xl shadow-indigo-600/30 transition-all active:scale-[0.99] disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
                    >
                        {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Thực Hiện Rút'}
                    </button>
                    {actualAmount > currentCapital && (
                        <p className="text-center text-rose-500 text-sm font-semibold mt-3">Số tiền rút không được vượt quá Tổng Vốn.</p>
                    )}
                </div>
            </div>

            {/* SUCCESS TOAST */}
            <div className={cn(
                "fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 pointer-events-none w-[90%] max-w-sm",
                showToast ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
            )}>
                <div className="bg-indigo-600 text-white rounded-2xl p-4 shadow-xl flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="font-bold text-lg">Thành công</p>
                        <p className="text-indigo-100 text-sm">Đã đưa tiền vào quỹ chi tiêu.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
