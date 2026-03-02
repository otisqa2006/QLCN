import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFarmContext } from '../contexts/FarmContext';
import { MapPin, Plus, Trash2, ArrowLeft, Loader2, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Farms() {
    const { user, isAdmin } = useAuth();
    const { farms, currentFarm, currentFarmRole, setCurrentFarm, refreshData } = useFarmContext();
    const navigate = useNavigate();

    const [showModal, setShowModal] = useState(false);
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [area, setArea] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !name.trim()) return;

        setIsSubmitting(true);
        try {
            const { error, data } = await supabase.from('farms').insert({
                user_id: user.id,
                name: name.trim(),
                location: location.trim() || 'N/A',
                area: area ? Number(area) : 1
            }).select();

            if (error) throw error;

            const newFarmId = data?.[0]?.id;

            // Re-fetch context data to update the list, passing new farm ID to ensure it gets selected
            await refreshData(newFarmId);

            setShowModal(false);
            setName('');
            setLocation('');
            setArea('');
        } catch (error: any) {
            alert('Lỗi: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, farmName: string) => {
        // Only OWNER can delete
        if (currentFarmRole !== 'OWNER' && !isAdmin) {
            alert('Chỉ chủ vườn mới có thể xóa khu vườn.');
            return;
        }

        // Check if farm has any data
        const checks = await Promise.all([
            supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('farm_id', id),
            supabase.from('harvest_seasons').select('id', { count: 'exact', head: true }).eq('farm_id', id),
            supabase.from('plots').select('id', { count: 'exact', head: true }).eq('farm_id', id),
            supabase.from('inventory_items').select('id', { count: 'exact', head: true }).eq('farm_id', id),
            supabase.from('workers').select('id', { count: 'exact', head: true }).eq('farm_id', id),
            supabase.from('farm_logs').select('id', { count: 'exact', head: true }).eq('farm_id', id),
        ]);

        const labels = ['Chi tiêu', 'Mùa vụ', 'Mảnh đất', 'Kho vật tư', 'Nhân công', 'Nhật ký'];
        const nonEmpty = checks
            .map((r, i) => (r.count ?? 0) > 0 ? labels[i] : null)
            .filter(Boolean);

        if (nonEmpty.length > 0) {
            alert(`Không thể xóa! Khu vườn "${farmName}" còn dữ liệu:\n• ${nonEmpty.join('\n• ')}\n\nHãy xóa hết dữ liệu trước khi xóa vườn.`);
            return;
        }

        const confirmDelete = window.confirm(`Xác nhận xóa khu vườn "${farmName}"?\n\nHành động này không thể hoàn tác.`);
        if (!confirmDelete) return;

        try {
            const { error } = await supabase.from('farms').delete().eq('id', id);
            if (error) throw error;

            if (currentFarm?.id === id) {
                setCurrentFarm(null);
            }
            await refreshData();
        } catch (error: any) {
            alert('Lỗi khi xóa: ' + error.message);
        }
    };

    return (
        <div className="p-4 space-y-6 pb-20">
            <header className="mb-6 mt-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-slate-200/50 rounded-full text-slate-600 hover:bg-slate-300/50 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <MapPin className="w-7 h-7 text-emerald-600" />
                            Khu Vườn
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Quản lý định danh các rẫy/vườn</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 p-2.5 rounded-xl transition-colors"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </header>

            <div className="space-y-3">
                {farms.length === 0 ? (
                    <p className="text-center text-slate-500 bg-white p-6 rounded-2xl border border-dashed border-slate-200">
                        Chưa có khu vườn nào. Hãy nhấn dấu + phía trên để thêm mới.
                    </p>
                ) : (
                    farms.map(f => (
                        <div key={f.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center relative overflow-hidden">
                            {currentFarm?.id === f.id && (
                                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                            )}
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                    {f.name}
                                    {currentFarm?.id === f.id && (
                                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                                            Đang Chọn
                                        </span>
                                    )}
                                </h3>
                                <div className="text-slate-500 text-sm mt-1 flex items-center gap-4">
                                    <span>Vị trí: {f.location}</span>
                                    <span>Diện tích: {f.area} ha</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(f.id, f.name)}
                                className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Create Farm Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm -m-4">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800">Thêm Khu Vườn</h2>
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 bg-slate-100 rounded-full">✕</button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Tên gọi (VD: Rẫy Đắk R'Măng)</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Vị trí (Không bắt buộc)</label>
                                <input
                                    type="text"
                                    value={location}
                                    onChange={e => setLocation(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Diện tích (ha)</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={area}
                                    onChange={e => setArea(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full mt-4 bg-emerald-600 text-white flex items-center justify-center gap-2 font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-70"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                Lưu Khu Vườn
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
