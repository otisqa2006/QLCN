import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Tags, Plus, Trash2, ArrowLeft, Loader2, ArrowRight, Edit2, Droplet, Bug, Scissors, Users, Utensils, Fuel, MoreHorizontal, Zap, ShoppingCart, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

// Predefined icons available for selection
const ICON_OPTIONS = [
    { name: 'Utensils', icon: Utensils, label: 'Ăn uống' },
    { name: 'ShoppingCart', icon: ShoppingCart, label: 'Mua sắm' },
    { name: 'Fuel', icon: Fuel, label: 'Nhiên liệu' },
    { name: 'Scissors', icon: Scissors, label: 'Công cụ' },
    { name: 'Droplet', icon: Droplet, label: 'Phân bón/Nước' },
    { name: 'Bug', icon: Bug, label: 'Sâu bệnh' },
    { name: 'Users', icon: Users, label: 'Nhân công' },
    { name: 'Zap', icon: Zap, label: 'Điện/Năng lượng' },
    { name: 'Wrench', icon: Wrench, label: 'Sửa chữa' },
    { name: 'MoreHorizontal', icon: MoreHorizontal, label: 'Khác' },
];

// Helper to get component by name
const getIconComponent = (name: string) => {
    const found = ICON_OPTIONS.find(opt => opt.name === name);
    return found ? found.icon : MoreHorizontal;
};

interface ExpenseCategory {
    id: string;
    name: string;
    icon_name?: string;
    color_code?: string;
}

export function ExpenseCategories() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [catName, setCatName] = useState('');
    const [catColor, setCatColor] = useState('#cbd5e1'); // Default slate-300
    const [catIcon, setCatIcon] = useState('MoreHorizontal');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchCategories = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('expense_categories')
                .select('*')
                .eq('user_id', user.id)
                .order('name');
            if (error) throw error;
            setCategories(data || []);
        } catch (error) {
            console.error('Error fetching categories:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, [user]);

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !catName.trim()) return;

        setIsSubmitting(true);
        try {
            if (editId) {
                // Update existing category
                const { error } = await supabase
                    .from('expense_categories')
                    .update({
                        name: catName.trim(),
                        color_code: catColor,
                        icon_name: catIcon
                    })
                    .eq('id', editId);

                if (error) throw error;
            } else {
                // Create new category
                const { error } = await supabase.from('expense_categories').insert({
                    user_id: user.id,
                    name: catName.trim(),
                    icon_name: catIcon,
                    color_code: catColor
                });

                if (error) throw error;
            }

            closeModal();
            fetchCategories(); // Refresh
        } catch (error: any) {
            alert('Lỗi khi lưu danh mục: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEditModal = (cat: ExpenseCategory) => {
        setEditId(cat.id);
        setCatName(cat.name);
        setCatColor(cat.color_code || '#cbd5e1');
        setCatIcon(cat.icon_name || 'MoreHorizontal');
        setShowModal(true);
    };

    const openCreateModal = () => {
        setEditId(null);
        setCatName('');
        setCatColor('#cbd5e1');
        setCatIcon('MoreHorizontal');
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditId(null);
        setCatName('');
        setCatColor('#cbd5e1');
        setCatIcon('MoreHorizontal');
    };

    const handleDeleteCategory = async (id: string, name: string) => {
        const confirmDelete = window.confirm(`Bạn có chắc chắn muốn xóa danh mục "${name}"? Các khoản chi tiêu thuộc danh mục này có thể bị mất hoặc không thể thống kê đúng.`);
        if (!confirmDelete) return;

        try {
            const { error } = await supabase
                .from('expense_categories')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchCategories();
        } catch (error: any) {
            alert('Không thể xóa danh mục này: ' + error.message);
        }
    };

    const PRESET_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4 pt-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6 pb-20">
            <header className="mb-6 mt-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-slate-200/50 rounded-full text-slate-600 hover:bg-slate-300/50 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <Tags className="w-7 h-7 text-indigo-500" />
                            Loại Chi Tiêu
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Quản lý danh mục chi tiêu</p>
                    </div>
                </div>
                <button
                    onClick={openCreateModal}
                    className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 p-2.5 rounded-xl transition-colors"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </header>

            <div className="space-y-3">
                {categories.length === 0 ? (
                    <p className="text-center text-slate-500 bg-white p-6 rounded-2xl border border-dashed border-slate-200">
                        Chưa có loại chi tiêu nào.
                    </p>
                ) : (
                    categories.map(cat => {
                        const Icon = getIconComponent(cat.icon_name || 'MoreHorizontal');
                        return (
                            <div key={cat.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                                        style={{ backgroundColor: cat.color_code || '#cbd5e1' }}
                                    >
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <span className="font-bold text-slate-800 text-lg">{cat.name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => openEditModal(cat)}
                                        className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                                    >
                                        <Edit2 className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                        className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Category Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800">{editId ? 'Sửa Loại Chi Tiêu' : 'Thêm Loại Chi Tiêu'}</h2>
                            <button onClick={closeModal} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">✕</button>
                        </div>
                        <form onSubmit={handleSaveCategory} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Tên loại chi tiêu</label>
                                <input
                                    type="text"
                                    required
                                    value={catName}
                                    onChange={e => setCatName(e.target.value)}
                                    placeholder="VD: Mua xăng, Phân bón..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Biểu tượng</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {ICON_OPTIONS.map(opt => {
                                        const Icon = opt.icon;
                                        return (
                                            <button
                                                key={opt.name}
                                                type="button"
                                                onClick={() => setCatIcon(opt.name)}
                                                title={opt.label}
                                                className={cn(
                                                    "aspect-square rounded-xl flex items-center justify-center transition-all",
                                                    catIcon === opt.name
                                                        ? "bg-slate-800 text-white shadow-md scale-105"
                                                        : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                                )}
                                            >
                                                <Icon className="w-5 h-5" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Màu sắc nhận diện</label>
                                <div className="flex gap-2 flex-wrap">
                                    {PRESET_COLORS.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setCatColor(color)}
                                            className={cn(
                                                "w-8 h-8 rounded-full transition-transform",
                                                catColor === color ? "scale-110 ring-2 ring-offset-2 ring-slate-800" : "hover:scale-105"
                                            )}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-indigo-600 text-white flex items-center justify-center gap-2 font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-70"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Lưu Danh Mục'}
                                {!isSubmitting && <ArrowRight className="w-5 h-5" />}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
