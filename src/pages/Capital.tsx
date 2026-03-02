import { useState, useEffect } from 'react';
import { UserPlus, PiggyBank, Loader2, CreditCard, Banknote, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function Capital() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [tab, setTab] = useState<'GOP_VON' | 'KHOAN_VAY'>('GOP_VON');

    const [loadingData, setLoadingData] = useState(true);
    const [wallets, setWallets] = useState<any[]>([]);
    const [contributors, setContributors] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Contribution State
    const [contributorId, setContributorId] = useState('');
    const [contribAmount, setContribAmount] = useState('');
    const [contribWalletType, setContribWalletType] = useState<'BANK' | 'CASH'>('BANK');

    // Loan State
    const [sourceName, setSourceName] = useState('');
    const [loanAmount, setLoanAmount] = useState('');
    const [interestRate, setInterestRate] = useState('');
    const [loanWalletType, setLoanWalletType] = useState<'BANK' | 'CASH'>('BANK');

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            try {
                // Fetch Wallets
                const { data: wals, error: walsError } = await supabase
                    .from('wallets')
                    .select('id, type')
                    .eq('user_id', user.id);
                if (walsError) throw walsError;
                setWallets(wals || []);

                // Fetch Contributors
                const { data: contribs, error: contribsError } = await supabase
                    .from('contributors')
                    .select('id, name')
                    .eq('user_id', user.id);
                if (contribsError) throw contribsError;
                setContributors(contribs || []);

            } catch (error) {
                console.error('Error fetching capital data:', error);
            } finally {
                setLoadingData(false);
            }
        };

        fetchData();
    }, [user]);

    const handleAddContribution = async (e: React.FormEvent) => {
        e.preventDefault();
        const amountNum = Number(contribAmount);

        if (!contributorId || !amountNum || amountNum <= 0) {
            alert('Vui lòng chọn cổ đông và nhập số tiền hợp lệ.');
            return;
        }

        setIsSubmitting(true);
        try {
            const selectedWallet = wallets.find(w => w.type === contribWalletType);
            if (!selectedWallet) throw new Error('Không tìm thấy ví tương ứng');

            const { error } = await supabase.from('contributions').insert({
                user_id: user?.id,
                contributor_id: contributorId,
                wallet_id: selectedWallet.id,
                amount: amountNum
            });

            if (error) throw error;

            alert('Góp vốn thành công!');
            setContribAmount('');
            setContributorId('');
        } catch (error: any) {
            console.error('Lỗi khi góp vốn:', error);
            alert('Lỗi: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddLoan = async (e: React.FormEvent) => {
        e.preventDefault();
        const princNum = Number(loanAmount);
        const intRate = Number(interestRate) || 0;

        if (!sourceName.trim() || !princNum || princNum <= 0) {
            alert('Vui lòng nhập nguồn vay và số tiền hợp lệ.');
            return;
        }

        setIsSubmitting(true);
        try {
            const selectedWallet = wallets.find(w => w.type === loanWalletType);
            if (!selectedWallet) throw new Error('Không tìm thấy ví tương ứng');

            const { error } = await supabase.from('loans').insert({
                user_id: user?.id,
                source_name: sourceName.trim(),
                wallet_id: selectedWallet.id,
                principal_amount: princNum,
                interest_rate_percent: intRate
            });

            if (error) throw error;

            alert('Tạo khoản vay thành công!');
            setSourceName('');
            setLoanAmount('');
            setInterestRate('');
        } catch (error: any) {
            console.error('Lỗi khi tạo khoản vay:', error);
            alert('Lỗi: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loadingData) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4 pt-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <p className="text-slate-500 font-medium">Đang tải biểu mẫu nguồn vốn...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <header className="bg-white px-4 py-3 border-b border-slate-200 flex items-center gap-3 sticky top-0 z-40">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Nguồn Vốn</h1>
                    <p className="text-slate-500 text-xs font-medium">Quản lý nhận vốn và vay nợ mới</p>
                </div>
            </header>

            <div className="p-4 space-y-4 overflow-y-auto pb-safe">

                {/* Custom Tabs */}
                <div className="flex p-1 bg-slate-200/50 rounded-2xl">
                    <button
                        onClick={() => setTab('GOP_VON')}
                        className={cn(
                            'flex-1 py-2.5 text-sm font-bold rounded-xl transition-all',
                            tab === 'GOP_VON' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 cursor-pointer hover:bg-slate-200'
                        )}
                    >
                        Nhận góp vốn
                    </button>
                    <button
                        onClick={() => setTab('KHOAN_VAY')}
                        className={cn(
                            'flex-1 py-2.5 text-sm font-bold rounded-xl transition-all',
                            tab === 'KHOAN_VAY' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 cursor-pointer hover:bg-slate-200'
                        )}
                    >
                        Vay vốn mới
                    </button>
                </div>

                {/* Forms */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                    {tab === 'GOP_VON' ? (
                        <form className="space-y-5" onSubmit={handleAddContribution}>
                            <div className="flex items-center justify-center w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl mb-4 shadow-sm mx-auto">
                                <UserPlus className="w-7 h-7" />
                            </div>

                            <div className="space-y-1.5 focus-within:text-emerald-600">
                                <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    <label>Người góp vốn</label>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/contributors')}
                                        className="text-emerald-600 hover:text-emerald-700 underline capitalize tracking-normal"
                                    >
                                        Quản lý Cổ đông
                                    </button>
                                </div>
                                <div className="relative">
                                    <select
                                        value={contributorId}
                                        onChange={(e) => setContributorId(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="" disabled>-- Chọn cổ đông --</option>
                                        {contributors.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5 focus-within:text-emerald-600">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Số tiền góp (VNĐ)</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    required
                                    value={contribAmount ? new Intl.NumberFormat('vi-VN').format(Number(contribAmount)) : ''}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        setContribAmount(val);
                                    }}
                                    placeholder="0"
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-lg font-bold rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:font-normal placeholder:text-slate-400"
                                />
                            </div>

                            <div className="space-y-1.5 pt-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chuyển trực tiếp vào quỹ</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setContribWalletType('BANK')}
                                        className={cn(
                                            'flex-1 flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all',
                                            contribWalletType === 'BANK' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100'
                                        )}
                                    >
                                        <CreditCard className="w-5 h-5 mb-1" />
                                        <span className="text-xs font-bold">Tk Ngân Hàng</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setContribWalletType('CASH')}
                                        className={cn(
                                            'flex-1 flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all',
                                            contribWalletType === 'CASH' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100'
                                        )}
                                    >
                                        <Banknote className="w-5 h-5 mb-1" />
                                        <span className="text-xs font-bold">Tiền Mặt</span>
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || contributors.length === 0 || !contribAmount}
                                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/30 transition-all mt-6 disabled:opacity-50"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Nhận Góp Vốn'}
                            </button>
                        </form>
                    ) : (
                        <form className="space-y-5" onSubmit={handleAddLoan}>
                            <div className="flex items-center justify-center w-14 h-14 bg-indigo-50 text-indigo-500 rounded-2xl mb-4 shadow-sm mx-auto">
                                <PiggyBank className="w-7 h-7" />
                            </div>

                            <div className="space-y-1.5 focus-within:text-indigo-600">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nguồn vay</label>
                                <input
                                    type="text"
                                    required
                                    value={sourceName}
                                    onChange={(e) => setSourceName(e.target.value)}
                                    placeholder="Vd: Ngân hàng Agribank, Người thân..."
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all placeholder:font-normal"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5 focus-within:text-indigo-600">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tổng Vay (VNĐ)</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        required
                                        value={loanAmount ? new Intl.NumberFormat('vi-VN').format(Number(loanAmount)) : ''}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            setLoanAmount(val);
                                        }}
                                        placeholder="0"
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all placeholder:font-normal"
                                    />
                                </div>
                                <div className="space-y-1.5 focus-within:text-indigo-600">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Lãi (%/tháng)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={interestRate}
                                        onChange={(e) => setInterestRate(e.target.value)}
                                        placeholder="0.0"
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all placeholder:font-normal"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 pt-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chuyển trực tiếp vào quỹ</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setLoanWalletType('BANK')}
                                        className={cn(
                                            'flex-1 flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all',
                                            loanWalletType === 'BANK' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100'
                                        )}
                                    >
                                        <CreditCard className="w-5 h-5 mb-1" />
                                        <span className="text-xs font-bold">Tk Ngân Hàng</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLoanWalletType('CASH')}
                                        className={cn(
                                            'flex-1 flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all',
                                            loanWalletType === 'CASH' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100'
                                        )}
                                    >
                                        <Banknote className="w-5 h-5 mb-1" />
                                        <span className="text-xs font-bold">Tiền Mặt</span>
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || !loanAmount || !sourceName}
                                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/30 transition-all mt-6 disabled:opacity-50"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Nhận Khoản Vay'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
