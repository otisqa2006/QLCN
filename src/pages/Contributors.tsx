import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, Loader2, ArrowLeft, Trash2, Edit2, X, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
interface Contributor {
    id: string;
    name: string;
    contact_info?: string;
    created_at?: string;
}

export function Contributors() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [contributors, setContributors] = useState<Contributor[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [contactInfo, setContactInfo] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (user) fetchContributors();
    }, [user]);

    const fetchContributors = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('contributors')
                .select('*')
                .eq('user_id', user?.id)
                .order('name');
            if (error) throw error;
            setContributors(data || []);
        } catch (error: any) {
            console.error('Error fetching contributors:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAddModal = () => {
        setEditingId(null);
        setName('');
        setContactInfo('');
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (c: Contributor) => {
        setEditingId(c.id);
        setName(c.name);
        setContactInfo(c.contact_info || '');
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            if (editingId) {
                // Update
                const { error } = await supabase
                    .from('contributors')
                    .update({ name: name.trim(), contact_info: contactInfo.trim() || null })
                    .eq('id', editingId)
                    .eq('user_id', user?.id);
                if (error) throw error;
            } else {
                // Insert
                const { error } = await supabase
                    .from('contributors')
                    .insert([{ user_id: user?.id, name: name.trim(), contact_info: contactInfo.trim() || null }]);
                if (error) throw error;
            }
            setIsModalOpen(false);
            fetchContributors();
        } catch (error: any) {
            alert('Lỗi lưu cổ đông: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Bạn có chắc muốn xoá cổ đông "${name}"? Thao tác này có thể không thực hiện được nếu họ đã từng góp vốn.`)) return;

        try {
            const { error } = await supabase
                .from('contributors')
                .delete()
                .eq('id', id)
                .eq('user_id', user?.id);

            if (error) {
                if (error.code === '23503') { // Foreign key violation
                    alert('Hệ thống từ chối: Cổ đông này đã có giao dịch góp vốn trên hệ thống. Bạn không thể xoá, chỉ có thể sửa tên.');
                } else {
                    throw error;
                }
            } else {
                fetchContributors();
            }
        } catch (error: any) {
            alert('Lỗi xoá cổ đông: ' + error.message);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <header className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between sticky top-0 z-40">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-800">Quản lý Cổ đông</h1>
                </div>
                <button
                    onClick={handleOpenAddModal}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-full shadow-sm transition-colors"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </header>

            {/* Content List */}
            <div className="p-4 space-y-3 overflow-y-auto pb-safe">
                {loading ? (
                    <div className="py-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
                ) : contributors.length === 0 ? (
                    <div className="py-10 text-center text-slate-400">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">Chưa có cổ đông nào trên hệ thống</p>
                    </div>
                ) : (
                    contributors.map((c) => (
                        <div key={c.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
                                    {c.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">{c.name}</h3>
                                    {c.contact_info ? (
                                        <p className="text-xs text-slate-500 font-medium">{c.contact_info}</p>
                                    ) : (
                                        <p className="text-[10px] text-slate-400 italic">Chưa có thông tin phụ</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handleOpenEditModal(c)}
                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(c.id, c.name)}
                                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Action Bottom Info */}
            <div className="px-4 py-6 text-center text-slate-400">
                <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Cổ đông đã từng góp vốn trên file CSDL sẽ không thể bị Xoá, để bảo toàn tính minh bạch kế toán.</p>
            </div>

            {/* Modal Add/Edit */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8">
                        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                            <h2 className="font-bold text-lg text-slate-800">{editingId ? 'Sửa thông tin' : 'Thêm Cổ đông mới'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 hover:text-rose-500 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Họ và Tên</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Vd: Nguyễn Văn A..."
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Thông tin liên hệ (tuỳ chọn)</label>
                                <input
                                    type="text"
                                    value={contactInfo}
                                    onChange={(e) => setContactInfo(e.target.value)}
                                    placeholder="SĐT, Email, Ngân hàng..."
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-medium px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || !name.trim()}
                                className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Lưu Hồ Sơ'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
