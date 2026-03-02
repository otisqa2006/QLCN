import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Warehouse, Plus, Minus, Loader2, ArrowRight, AlertCircle, Package, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

type ItemCategory = 'PHAN_BON' | 'THUOC_BVTV' | 'KHAC';
type ItemUnit = 'CHAI' | 'BAO' | 'LIT' | 'KG';
type TransactionType = 'IN' | 'OUT';

interface InventoryItem {
    id: string;
    name: string;
    category: ItemCategory;
    unit: ItemUnit;
    stock_quantity: number;
}

export function Inventory() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<ItemCategory>('PHAN_BON');
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Transaction Modal State
    const [showModal, setShowModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [txType, setTxType] = useState<TransactionType>('IN');
    const [txQuantity, setTxQuantity] = useState('');
    const [txNotes, setTxNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchItems = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('user_id', user.id)
                .order('name');
            if (error) throw error;
            setItems(data || []);
        } catch (error) {
            console.error('Lỗi khi tải danh sách vật tư:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [user]);

    const filteredItems = items.filter(i => i.category === activeTab);

    const handleOpenModal = (item: InventoryItem, type: TransactionType) => {
        setSelectedItem(item);
        setTxType(type);
        setTxQuantity('');
        setTxNotes('');
        setShowModal(true);
    };

    const handleSubmitTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !selectedItem) return;

        const qty = Number(txQuantity);
        if (!qty || qty <= 0) {
            alert('Vui lòng nhập số lượng hợp lệ.');
            return;
        }

        if (txType === 'OUT' && qty > selectedItem.stock_quantity) {
            alert('Số lượng xuất vượt quá tồn kho hiện tại!');
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('inventory_transactions').insert({
                user_id: user.id,
                item_id: selectedItem.id,
                type: txType,
                quantity: qty,
                notes: txNotes.trim()
            });

            if (error) throw error;

            alert(txType === 'IN' ? 'Nhập kho thành công!' : 'Xuất kho thành công!');
            setShowModal(false);
            fetchItems(); // Refresh items
        } catch (error: any) {
            console.error('Lỗi giao dịch kho:', error);
            alert('Lỗi: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4 pt-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <p className="text-slate-500 font-medium">Đang tải danh sách vật tư...</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6 pb-20">
            <header className="mb-6 mt-4 flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-slate-200/50 rounded-full text-slate-600 hover:bg-slate-300/50 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <Warehouse className="w-7 h-7 text-emerald-600" />
                        Kho Vật Tư
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Quản lý nhập xuất & tồn kho mảng Nông nghiệp</p>
                </div>
            </header>

            {/* Category Tabs */}
            <div className="flex p-1 bg-slate-100/80 rounded-2xl space-x-1 overflow-x-auto hide-scrollbar border border-slate-200/50">
                {[
                    { id: 'PHAN_BON', label: 'Phân bón' },
                    { id: 'THUOC_BVTV', label: 'Thuốc BVTV' },
                    { id: 'KHAC', label: 'Khác' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as ItemCategory)}
                        className={cn(
                            'block px-4 py-2.5 text-sm font-semibold rounded-xl transition-all flex-shrink-0',
                            activeTab === tab.id
                                ? 'bg-white shadow-sm text-emerald-700 ring-1 ring-slate-200'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Item List */}
            <div className="space-y-4">
                {filteredItems.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">Chưa có bật tư nào trong danh mục này.</p>
                    </div>
                ) : (
                    filteredItems.map(item => {
                        const isLowStock = item.stock_quantity <= 5;
                        return (
                            <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-slate-800 text-lg">{item.name}</h3>
                                        <div className="flex items-center gap-2">
                                            {isLowStock ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                                                    <AlertCircle className="w-3 h-3" />
                                                    Sắp hết
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                                    Còn đủ xuất
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={cn(
                                            "text-2xl font-black tabular-nums tracking-tight",
                                            isLowStock ? "text-rose-600" : "text-slate-800"
                                        )}>
                                            {item.stock_quantity}
                                        </div>
                                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">{item.unit}</div>
                                    </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="flex gap-2 pt-2 border-t border-slate-50">
                                    <button
                                        onClick={() => handleOpenModal(item, 'IN')}
                                        className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl transition-colors text-sm"
                                    >
                                        <Plus className="w-4 h-4" /> Bổ sung
                                    </button>
                                    <button
                                        onClick={() => handleOpenModal(item, 'OUT')}
                                        className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold rounded-xl transition-colors text-sm"
                                        disabled={item.stock_quantity <= 0}
                                    >
                                        <Minus className="w-4 h-4" /> Đem xịt/rải
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Transaction Modal Popup */}
            {showModal && selectedItem && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800">
                                {txType === 'IN' ? 'Nhập thêm ' : 'Xuất kho '} {selectedItem.name}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-full transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmitTransaction} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Số lượng ({selectedItem.unit})</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={txQuantity}
                                    onChange={(e) => setTxQuantity(e.target.value)}
                                    placeholder="0"
                                    className={cn(
                                        "w-full bg-slate-50 border border-slate-200 text-xl font-bold rounded-xl px-4 py-3 outline-none focus:ring-2 transition-all placeholder:font-normal placeholder:text-slate-400",
                                        txType === 'IN' ? "text-blue-700 focus:ring-blue-500/20 focus:border-blue-500" : "text-amber-700 focus:ring-amber-500/20 focus:border-amber-500"
                                    )}
                                />
                                {txType === 'OUT' && (
                                    <p className="text-xs text-slate-500 text-right mt-1">
                                        Tối đa xuất được: <strong className="text-slate-800">{selectedItem.stock_quantity}</strong>
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Ghi chú (Tùy chọn)</label>
                                <input
                                    type="text"
                                    value={txNotes}
                                    onChange={(e) => setTxNotes(e.target.value)}
                                    placeholder={txType === 'IN' ? "VD: Nhập thêm từ đại lý..." : "VD: Xịt vườn cam..."}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all text-sm"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={cn(
                                    "w-full flex items-center justify-center gap-2 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] mt-6 disabled:opacity-70 disabled:active:scale-100",
                                    txType === 'IN' ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/30" : "bg-amber-500 hover:bg-amber-600 shadow-amber-500/30"
                                )}
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Xác Nhận'}
                                {!isSubmitting && <ArrowRight className="w-5 h-5" />}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
