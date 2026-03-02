import { useState, useEffect, useRef } from 'react';
import { Droplet, Bug, Scissors, Users, Utensils, Fuel, MoreHorizontal, CreditCard, Banknote, Loader2, Calendar, Plus, ChevronLeft, ChevronRight, Zap, ShoppingCart, Wrench, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFarmContext } from '../contexts/FarmContext';
import { useNavigate } from 'react-router-dom';
import { ensureUserSystemData } from '../lib/autoHeal';
import { logExpenseAction } from '../lib/expenseLogger';

// Map icon names from DB to actual lucide components
const iconMap: Record<string, any> = {
    Droplet, Bug, Scissors, Users, Utensils, Fuel, MoreHorizontal, Zap, ShoppingCart, Wrench
};

const getCategoryIcon = (cat: any) => {
    if (cat.icon_name && iconMap[cat.icon_name]) return iconMap[cat.icon_name];
    const name = (cat.name || '').toLowerCase();
    if (name.includes('ăn') || name.includes('thực phẩm')) return Utensils;
    if (name.includes('nông') || name.includes('công cụ') || name.includes('kéo')) return Scissors;
    if (name.includes('tạp hoá') || name.includes('vật tư')) return ShoppingCart;
    if (name.includes('xăng') || name.includes('dầu')) return Fuel;
    if (name.includes('nhân công') || name.includes('thuê') || name.includes('lương')) return Users;
    if (name.includes('phân') || name.includes('thuốc')) return Droplet;
    if (name.includes('điện') || name.includes('nước')) return Zap;
    if (name.includes('sửa chữa') || name.includes('bảo trì')) return Wrench;
    return MoreHorizontal;
};

export function Expenses() {
    const { user } = useAuth();
    const { currentFarm, currentSeason } = useFarmContext();
    const navigate = useNavigate();

    const [categories, setCategories] = useState<any[]>([]);
    const [wallets, setWallets] = useState<any[]>([]);
    const [expenseFund, setExpenseFund] = useState<any>(null);
    const [loadingData, setLoadingData] = useState(true);

    const [selectedCatId, setSelectedCatId] = useState<string>('');
    const [walletType, setWalletType] = useState<'BANK' | 'CASH'>('BANK');

    // Amount formatting state (displayAmount e.g. "500", represents 500.000)
    const [displayAmount, setDisplayAmount] = useState<string>('');

    const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showToast, setShowToast] = useState(false);

    const amountInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            try {
                await ensureUserSystemData(user.id);

                const { data: cats, error: catsError } = await supabase
                    .from('expense_categories')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('name');
                if (catsError) throw catsError;

                if (cats && cats.length > 0) {
                    setCategories(cats);
                    setSelectedCatId(cats[0].id);
                }

                const { data: wals, error: walsError } = await supabase
                    .from('wallets')
                    .select('id, type')
                    .eq('user_id', user.id);
                if (walsError) throw walsError;
                setWallets(wals || []);

                const { data: fund, error: fundError } = await supabase
                    .from('funds')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('type', 'EXPENSE_FUND')
                    .single();
                if (fundError && fundError.code !== 'PGRST116') throw fundError;
                setExpenseFund(fund);

            } catch (error) {
                console.error('Error loading expense prerequisites:', error);
            } finally {
                setLoadingData(false);
            }
        };

        fetchData();

        // Auto-focus amount input on load
        setTimeout(() => {
            if (amountInputRef.current) {
                amountInputRef.current.focus();
            }
        }, 100);
    }, [user]);

    // Handle Amount Input: format with dots, strip non-digits. User input implicitly represents thousands.
    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, '');
        if (!raw) {
            setDisplayAmount('');
            return;
        }
        const formatted = new Intl.NumberFormat('vi-VN').format(Number(raw));
        setDisplayAmount(formatted);
    };

    // Actual value to save into Supabase
    const actualAmountStr = displayAmount.replace(/\D/g, '');
    const actualAmount = actualAmountStr ? Number(actualAmountStr) * 1000 : 0;

    const handleSaveExpense = async () => {
        if (!actualAmount || actualAmount <= 0) {
            alert('Vui lòng nhập số tiền hợp lệ');
            return;
        }
        if (!expenseFund || wallets.length === 0) {
            alert('Lỗi hệ thống: Tài khoản chưa khởi tạo Ví hoặc Quỹ chi tiêu.');
            return;
        }
        if (!selectedCatId) {
            alert('Vui lòng chọn danh mục chi tiêu! (Nếu chưa có, hãy bấm "Thêm Mới")');
            return;
        }
        if (!currentFarm || !currentSeason) {
            alert('Vui lòng chọn Khu Vườn và Mùa Vụ trước khi ghi nhận chi tiêu.');
            return;
        }

        setIsSubmitting(true);
        try {
            const selectedWallet = wallets.find(w => w.type === walletType);
            if (!selectedWallet) throw new Error('Không tìm thấy ví tương ứng');

            const { error } = await supabase.from('expenses').insert({
                user_id: user?.id,
                farm_id: currentFarm.id,
                season_id: currentSeason.id,
                category_id: selectedCatId,
                wallet_id: selectedWallet.id,
                fund_id: expenseFund.id,
                amount: actualAmount,
                date: expenseDate,
                description: notes.trim() || null
            });

            if (error) throw error;

            // Log the CREATE action (fire-and-forget)
            const selectedCat = categories.find(c => c.id === selectedCatId);
            logExpenseAction({
                userId: user!.id,
                farmId: currentFarm.id,
                seasonId: currentSeason.id,
                action: 'CREATE',
                amount: actualAmount,
                category: selectedCat?.name ?? null,
                description: notes.trim() || null,
            });

            // Show toast
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);

            // Reset form
            setDisplayAmount('');
            setNotes('');
            // Keep date and category as they might enter multiple similar expenses

        } catch (error: any) {
            alert('Lỗi: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loadingData) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4 pt-20 bg-slate-50 text-emerald-600">
                <Loader2 className="w-10 h-10 animate-spin" />
                <p className="font-bold tracking-widest uppercase text-sm">Đang tải biểu mẫu...</p>
            </div>
        );
    }

    // Format date for display
    const dateObj = new Date(expenseDate);
    const dateStr = dateObj.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-y-auto pb-[120px]">
            {/* === COMPACT HEADER === */}
            <header className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-1">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-800">Tạo khoản chi</h1>
                </div>
            </header>

            <div className="px-4 pt-6 space-y-8 max-w-lg mx-auto w-full">

                {/* === MOVED AMOUNT INPUT & FORMATTING === */}
                <div className="text-center">
                    <p className="text-sm font-semibold text-slate-500 mb-2">Số tiền (VNĐ)</p>

                    {/* The Input Overlay Trick */}
                    <div className="relative inline-flex flex-col items-center justify-center group w-full mb-2">
                        {/* Hidden Input Layer */}
                        <input
                            ref={amountInputRef}
                            type="text"
                            inputMode="numeric"
                            value={displayAmount}
                            onChange={handleAmountChange}
                            className="absolute inset-0 w-full h-[60px] opacity-0 cursor-text z-20 caret-transparent"
                            placeholder="0"
                        />

                        {/* Visual Layer */}
                        <div className={cn(
                            "flex items-baseline justify-center text-5xl font-black transition-colors border-b-2 pb-1 border-emerald-500/30 group-focus-within:border-emerald-500",
                            displayAmount ? "text-slate-800" : "text-slate-300"
                        )}>
                            <span>{displayAmount || '0'}</span>
                            {/* The .000 is always prominently appended */}
                            {displayAmount && <span className="text-emerald-500">.000</span>}
                            <span className="text-2xl text-slate-400 ml-1">đ</span>
                        </div>
                    </div>
                </div>

                {/* === CATEGORY SELECTOR (HORIZONTAL PILLS WITH INLINE ICON) === */}
                <div className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-500 mb-3 text-xs uppercase tracking-wider">Danh mục chi</h3>
                    <div className="flex flex-wrap gap-2">
                        {categories.map((cat) => {
                            const isSelected = selectedCatId === cat.id;
                            const IconComponent = getCategoryIcon(cat);

                            const hasColor = !!cat.color_code;
                            const isHex = hasColor && cat.color_code.startsWith('#');
                            const selectedBgColor = hasColor && isHex ? `${cat.color_code}1A` : undefined;

                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCatId(cat.id)}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all border',
                                        isSelected
                                            ? 'shadow-sm border-current'
                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    )}
                                    style={isSelected ? {
                                        color: hasColor ? cat.color_code : '#10b981',
                                        backgroundColor: selectedBgColor || '#ecfdf5'
                                    } : {}}
                                >
                                    <div style={!isSelected && hasColor ? { color: cat.color_code } : {}} className={isSelected ? "" : "opacity-80"}>
                                        <IconComponent className="w-4 h-4" />
                                    </div>
                                    <span>{cat.name}</span>
                                </button>
                            );
                        })}

                        <button
                            onClick={() => navigate('/expense-categories')}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold text-slate-500 border border-dashed border-slate-300 hover:bg-slate-50 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Thêm
                        </button>
                    </div>
                </div>

                {/* === CUSTOM DATE PICKER === */}
                <div className="bg-white rounded-[1.5rem] p-4 shadow-sm border border-slate-100 relative group overflow-hidden transition-all hover:border-emerald-200 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-500/20">
                    {/* The visible UI Cover */}
                    <div className="flex items-center justify-between relative z-10 pointer-events-none">
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Ngày Giao Dịch</p>
                                <p className="text-base font-bold text-slate-800 capitalize leading-tight mt-0.5">{dateStr}</p>
                            </div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-full text-slate-400">
                            <ChevronRight className="w-4 h-4" />
                        </div>
                    </div>

                    {/* The Full Coverage Invisible Input */}
                    <input
                        type="date"
                        value={expenseDate}
                        onChange={(e) => setExpenseDate(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 outline-none"
                        onClick={(e) => {
                            try {
                                if ('showPicker' in HTMLInputElement.prototype) {
                                    (e.target as HTMLInputElement).showPicker();
                                }
                            } catch (err) { }
                        }}
                    />
                </div>

                {/* === NOTES INPUT === */}
                <div className="bg-white rounded-[1.5rem] p-4 shadow-sm border border-slate-100 transition-all focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-500/20">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight mb-2">Ghi Chú</p>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="VD: Mua phân bón đại lý X..."
                        rows={2}
                        className="w-full text-base font-medium text-slate-800 bg-transparent outline-none resize-none placeholder:text-slate-300"
                    />
                </div>

                {/* === WALLETS === */}
                <div className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-500 mb-3 text-xs uppercase tracking-wider">Nguồn Tiền</h3>
                    <div className="flex gap-3">
                        {/* BANK */}
                        <button
                            onClick={() => setWalletType('BANK')}
                            className={cn(
                                "flex-1 p-3 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all border-2",
                                walletType === 'BANK' ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-100 bg-slate-50 text-slate-500"
                            )}
                        >
                            <CreditCard className="w-5 h-5" /> Chuyển khoản
                        </button>

                        {/* CASH */}
                        <button
                            onClick={() => setWalletType('CASH')}
                            className={cn(
                                "flex-1 p-3 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all border-2",
                                walletType === 'CASH' ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-100 bg-slate-50 text-slate-500"
                            )}
                        >
                            <Banknote className="w-5 h-5" /> Tiền mặt
                        </button>
                    </div>
                </div>

                {/* === NORMAL FLOW SUBMIT BUTTON === */}
                <div className="pt-2 pb-8">
                    <button
                        onClick={handleSaveExpense}
                        disabled={isSubmitting || actualAmount <= 0}
                        className="w-full flex justify-center items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-lg py-4 rounded-2xl shadow-xl shadow-slate-900/20 transition-all active:scale-[0.99] disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
                    >
                        {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Lưu Khoản Chi'}
                    </button>
                </div>
            </div>

            {/* === SUCCESS TOAST === */}
            <div className={cn(
                "fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 pointer-events-none w-[90%] max-w-sm",
                showToast ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
            )}>
                <div className="bg-emerald-500 text-white rounded-2xl p-4 shadow-xl flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="font-bold text-lg">Thành công</p>
                        <p className="text-emerald-50 text-sm">Đã lưu khoản chi vào hệ thống.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
