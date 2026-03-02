import { useState, useEffect } from 'react';
import { Scale, Tag, Calculator, Loader2, CreditCard, Banknote, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, formatNumber } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFarmContext } from '../contexts/FarmContext';

export function Harvest() {
    const { user } = useAuth();
    const { currentFarm, currentSeason } = useFarmContext();
    const navigate = useNavigate();
    const [loadingData, setLoadingData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [wallets, setWallets] = useState<any[]>([]);

    const [treeType, setTreeType] = useState<'THAI_DONA' | 'RI6'>('THAI_DONA');
    const [walletType, setWalletType] = useState<'BANK' | 'CASH'>('BANK');
    const [weight, setWeight] = useState<string>('');
    const [price, setPrice] = useState<string>('');

    const totalRevenue = (Number(weight) || 0) * (Number(price) || 0);

    useEffect(() => {
        if (!user) return;
        const fetchData = async () => {
            try {
                const { data: wals, error: walsError } = await supabase
                    .from('wallets')
                    .select('id, type')
                    .eq('user_id', user.id);
                if (walsError) throw walsError;
                setWallets(wals || []);
            } catch (error) {
                console.error('Error fetching harvest data:', error);
            } finally {
                setLoadingData(false);
            }
        };
        fetchData();
    }, [user]);

    const handleSaveHarvest = async () => {
        const weightNum = Number(weight);
        const priceNum = Number(price);

        if (!weightNum || weightNum <= 0 || !priceNum || priceNum <= 0) {
            alert('Vui lòng nhập khối lượng và đơn giá hợp lệ.');
            return;
        }
        if (!currentFarm || !currentSeason) {
            alert('Vui lòng chọn Khu Vườn và Mùa Vụ trước.');
            return;
        }
        if (wallets.length === 0) {
            alert('Hệ thống chưa sẵn sàng.');
            return;
        }

        setIsSubmitting(true);
        try {
            const selectedWallet = wallets.find(w => w.type === walletType);
            if (!selectedWallet) throw new Error('Không tìm thấy ví tương ứng');

            const { error } = await supabase.from('harvest_batches').insert({
                user_id: user?.id,
                season_id: currentSeason.id,
                wallet_id: selectedWallet.id,
                tree_type: treeType,
                weight_kg: weightNum,
                price_per_kg: priceNum
            });

            if (error) throw error;

            alert('Đã lưu dữ liệu thu hoạch thành công!');
            setWeight('');
            setPrice('');
        } catch (error: any) {
            console.error('Lỗi khi lưu doanh thu:', error);
            alert('Lỗi: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loadingData) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4 pt-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <p className="text-slate-500 font-medium">Đang tải biểu mẫu thu hoạch...</p>
            </div>
        );
    }


    return (
        <div className="p-4 space-y-6 pb-24 h-full overflow-y-auto">
            <header className="mb-6 mt-4 flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-slate-200/50 rounded-full text-slate-600 hover:bg-slate-300/50 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Thu Hoạch</h1>
                    <p className="text-slate-500 text-sm mt-1">Ghi nhận doanh thu bán sầu riêng</p>
                </div>
            </header>

            {/* Chọn Giống */}
            <div className="flex p-1 bg-slate-100 rounded-xl space-x-1">
                <button
                    onClick={() => setTreeType('THAI_DONA')}
                    className={cn(
                        'flex-1 py-4 text-sm font-bold rounded-lg transition-all flex flex-col items-center gap-1',
                        treeType === 'THAI_DONA' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:bg-slate-200/50 cursor-pointer'
                    )}
                >
                    <span>Thái Dona</span>
                </button>
                <button
                    onClick={() => setTreeType('RI6')}
                    className={cn(
                        'flex-1 py-4 text-sm font-bold rounded-lg transition-all flex flex-col items-center gap-1',
                        treeType === 'RI6' ? 'bg-white shadow text-amber-600' : 'text-slate-500 hover:bg-slate-200/50 cursor-pointer'
                    )}
                >
                    <span>Ri6</span>
                </button>
            </div>

            {/* Nhập liệu */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-5">
                <div className="space-y-1.5 flex flex-col">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Scale className="w-4 h-4 text-slate-400" />
                        Khối lượng chốt (Kg)
                    </label>
                    <input
                        type="number"
                        value={weight}
                        onChange={e => setWeight(e.target.value)}
                        placeholder="0"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-2xl font-bold rounded-xl px-4 py-4 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-right"
                    />
                </div>

                <div className="space-y-1.5 flex flex-col">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-slate-400" />
                        Giá bán (VNĐ/kg)
                    </label>
                    <input
                        type="number"
                        value={price}
                        onChange={e => setPrice(e.target.value)}
                        placeholder="0"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-2xl font-bold rounded-xl px-4 py-4 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-right"
                    />
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <label className="text-sm font-semibold text-slate-700">Chuyển tiền vào Ví/Két</label>
                    <div className="flex p-1 bg-slate-50 rounded-xl space-x-1 border border-slate-100">
                        <button
                            type="button"
                            onClick={() => setWalletType('BANK')}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold rounded-lg transition-all',
                                walletType === 'BANK' ? 'bg-white shadow border border-slate-200 text-blue-600' : 'text-slate-500 hover:bg-slate-200/50'
                            )}
                        >
                            <CreditCard className="w-4 h-4" />
                            Bank
                        </button>
                        <button
                            type="button"
                            onClick={() => setWalletType('CASH')}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold rounded-lg transition-all',
                                walletType === 'CASH' ? 'bg-white shadow border border-slate-200 text-amber-600' : 'text-slate-500 hover:bg-slate-200/50'
                            )}
                        >
                            <Banknote className="w-4 h-4" />
                            Tiền Mặt
                        </button>
                    </div>
                </div>
            </div>

            {/* Tổng Mẻ */}
            <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 mb-6">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold mb-2">
                    <Calculator className="w-5 h-5" />
                    <span>Tạm Tính Biên Lai</span>
                </div>
                <div className="text-4xl font-extrabold text-emerald-600 tracking-tight break-all">
                    {formatNumber(totalRevenue)} <span className="text-xl font-semibold">đ</span>
                </div>
                <p className="text-xs text-emerald-600/80 mt-2 font-medium">Doanh thu sẽ tự động cộng vào Quỹ "Tổng Vốn"</p>
            </div>

            <button
                onClick={handleSaveHarvest}
                disabled={isSubmitting || totalRevenue <= 0}
                className="w-full flex justify-center items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-emerald-500/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
            >
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Xác Nhận Thu Hoạch'}
            </button>
        </div>
    );
}
