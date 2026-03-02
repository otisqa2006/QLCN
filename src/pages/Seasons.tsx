import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFarmContext } from '../contexts/FarmContext';
import { CalendarDays, Plus, Trash2, ArrowLeft, Loader2, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Seasons() {
    const { user, isAdmin } = useAuth();
    const { seasons, currentFarm, currentSeason, currentFarmRole, setCurrentSeason, refreshData } = useFarmContext();
    const navigate = useNavigate();

    const [showModal, setShowModal] = useState(false);
    const [name, setName] = useState('');
    const [year, setYear] = useState<string>(new Date().getFullYear().toString());
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !name.trim() || !currentFarm) return;

        setIsSubmitting(true);
        try {
            const { error, data } = await supabase.from('harvest_seasons').insert({
                user_id: user.id,
                farm_id: currentFarm.id,
                name: name.trim(),
                year: Number(year),
                status: 'IN_PROGRESS'
            }).select();

            if (error) throw error;

            const newSeasonId = data?.[0]?.id;

            // Re-fetch context data, passing new season ID to ensure it gets selected
            await refreshData(currentFarm.id, newSeasonId);

            setShowModal(false);
            setName('');
            setYear(new Date().getFullYear().toString());
        } catch (error: any) {
            alert('Lỗi: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, seasonName: string) => {
        // Only OWNER can delete
        if (currentFarmRole !== 'OWNER' && !isAdmin) {
            alert('Chỉ chủ vườn mới có thể xóa mùa vụ.');
            return;
        }

        // Check if season has any data
        const checks = await Promise.all([
            supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('season_id', id),
            supabase.from('harvest_batches').select('id', { count: 'exact', head: true }).eq('season_id', id),
            supabase.from('farm_logs').select('id', { count: 'exact', head: true }).eq('season_id', id),
            supabase.from('timesheets').select('id', { count: 'exact', head: true }).eq('season_id', id),
            supabase.from('inventory_transactions').select('id', { count: 'exact', head: true }).eq('season_id', id),
        ]);

        const labels = ['Chi tiêu', 'Lô thu hoạch', 'Nhật ký', 'Chấm công', 'Xuất/nhập kho'];
        const nonEmpty = checks
            .map((r, i) => (r.count ?? 0) > 0 ? labels[i] : null)
            .filter(Boolean);

        if (nonEmpty.length > 0) {
            alert(`Không thể xóa! Mùa vụ "${seasonName}" còn dữ liệu:\n• ${nonEmpty.join('\n• ')}\n\nHãy xóa hết dữ liệu trước khi xóa mùa vụ.`);
            return;
        }

        const confirmDelete = window.confirm(`Xác nhận xóa mùa vụ "${seasonName}"?\n\nHành động này không thể hoàn tác.`);
        if (!confirmDelete) return;

        try {
            const { error } = await supabase.from('harvest_seasons').delete().eq('id', id);
            if (error) throw error;

            if (currentSeason?.id === id) {
                setCurrentSeason(null);
            }
            await refreshData();
        } catch (error: any) {
            alert('Lỗi khi xóa: ' + error.message);
        }
    };

    if (!currentFarm) {
        return (
            <div className="p-4 flex flex-col items-center justify-center h-full text-center space-y-4">
                <CalendarDays className="w-12 h-12 text-slate-300" />
                <p className="text-slate-500 font-medium">Vui lòng chọn Khu Vườn trước để quản lý Mùa Vụ.</p>
                <button onClick={() => navigate(-1)} className="text-blue-500 font-bold">Quay lại</button>
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
                            <CalendarDays className="w-7 h-7 text-blue-600" />
                            Mùa Vụ
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Của vườn: <span className="font-bold text-slate-700">{currentFarm.name}</span></p>
                    </div>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-100 text-blue-700 hover:bg-blue-200 p-2.5 rounded-xl transition-colors"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </header>

            <div className="space-y-3">
                {seasons.length === 0 ? (
                    <p className="text-center text-slate-500 bg-white p-6 rounded-2xl border border-dashed border-slate-200">
                        Chưa có mùa vụ nào trong vườn này.
                    </p>
                ) : (
                    seasons.map(s => (
                        <div key={s.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center relative overflow-hidden">
                            {currentSeason?.id === s.id && (
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                            )}
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                    {s.name}
                                    {currentSeason?.id === s.id && (
                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                                            Đang Chọn
                                        </span>
                                    )}
                                </h3>
                                <div className="text-slate-500 text-sm mt-1 flex items-center gap-2">
                                    <span className="bg-slate-100 px-2 py-1 rounded-md text-slate-600 font-semibold">{s.year}</span>
                                    <span className={s.status === 'IN_PROGRESS' ? 'text-emerald-600' : 'text-slate-400'}>
                                        {s.status === 'IN_PROGRESS' ? 'Đang Diễn Ra' : 'Đã Kết Thúc'}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(s.id, s.name)}
                                className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Create Season Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm -m-4">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800">Thêm Mùa Vụ</h2>
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 bg-slate-100 rounded-full">✕</button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Tên mùa vụ (VD: Vụ chính, Vụ nghịch)</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Năm thu hoạch</label>
                                <input
                                    type="number"
                                    required
                                    value={year}
                                    onChange={e => setYear(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full mt-4 bg-blue-600 text-white flex items-center justify-center gap-2 font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-70"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                Lưu Mùa Vụ
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
