import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, User, Search, RefreshCw, ShieldAlert, Terminal, Lock, Unlock } from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate, Link } from 'react-router-dom';

interface Profile {
    id: string;
    email: string;
    full_name: string | null;
    is_admin: boolean;
    is_locked: boolean;
    created_at: string;
}

export function AdminUsers() {
    const { isAdmin, user } = useAuth();
    const navigate = useNavigate();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!user) return;
        if (!isAdmin) {
            // Redirect non-admins away
            navigate('/');
            return;
        }

        fetchUsers();
    }, [user, isAdmin, navigate]);

    const fetchUsers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setProfiles(data);
        } else {
            console.error("Failed to fetch profiles", error);
        }
        setLoading(false);
    };

    const toggleAdminStatus = async (profileId: string, currentStatus: boolean) => {
        if (profileId === user?.id) {
            alert("Bạn không thể tự gỡ quyền Admin của chính mình.");
            return;
        }

        // Optimistic UI update
        setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, is_admin: !currentStatus } : p));

        const { error } = await supabase
            .from('profiles')
            .update({ is_admin: !currentStatus })
            .eq('id', profileId);

        if (error) {
            console.error("Error updating admin status:", error);
            // Revert on failure
            fetchUsers();
            alert("Lỗi khi cập nhật quyền: " + error.message);
        }
    };

    const toggleLock = async (profileId: string, currentLocked: boolean) => {
        if (profileId === user?.id) {
            alert('Bạn không thể tự khoá tài khoản của chính mình.');
            return;
        }
        // Optimistic update
        setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, is_locked: !currentLocked } : p));

        const { error } = await supabase
            .from('profiles')
            .update({ is_locked: !currentLocked })
            .eq('id', profileId);

        if (error) {
            fetchUsers();
            alert('Lỗi khi cập nhật: ' + error.message);
        }
    };

    const filteredProfiles = profiles.filter(p =>
        p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.full_name && p.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (!isAdmin) {
        return null; // Should redirect via useEffect
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20 pt-16 px-4">
            <div className="max-w-4xl mx-auto space-y-6 mt-4">

                {/* Header */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
                            <ShieldCheck className="w-7 h-7 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight">Quản Trị Người Dùng</h1>
                            <p className="text-sm font-medium text-slate-300 opacity-90 mt-1">
                                Quản lý phân quyền toàn hệ thống
                            </p>
                        </div>
                    </div>
                </div>

                {/* Expense Logs Link */}
                <Link
                    to="/expense-logs"
                    className="flex items-center gap-4 bg-black border border-green-900 hover:border-green-600 rounded-3xl p-5 shadow-xl transition-all group"
                >
                    <div className="w-12 h-12 bg-green-950 rounded-2xl flex items-center justify-center border border-green-800 group-hover:border-green-500 transition-colors">
                        <Terminal className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                        <h2 className="font-bold text-green-400 font-mono tracking-wider text-base">EXPENSE_LOGS</h2>
                        <p className="text-green-900 text-xs font-mono mt-0.5">audit trail · all write operations</p>
                    </div>
                </Link>

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Tìm kiếm email, tên..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-2xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:text-sm font-medium transition-shadow shadow-sm"
                        />
                    </div>
                    <button
                        onClick={fetchUsers}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Làm Mới
                    </button>
                </div>

                {/* Main List */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    {filteredProfiles.length === 0 ? (
                        <div className="p-10 text-center text-slate-500">
                            Không tìm thấy người dùng nào.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filteredProfiles.map((profile) => (
                                <div key={profile.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                            <User className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-slate-800">
                                                {profile.full_name || 'Người dùng ẩn danh'}
                                            </h3>
                                            <p className="text-sm font-medium text-slate-500 mt-0.5">{profile.email}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2 border-t border-slate-100 sm:border-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
                                        {/* Lock badge */}
                                        {profile.is_locked && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-600 flex items-center gap-1">
                                                <Lock className="w-3 h-3" /> KHÓA
                                            </span>
                                        )}

                                        <span className={cn(
                                            "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5",
                                            profile.is_admin ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                                        )}>
                                            {profile.is_admin ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                                            {profile.is_admin ? 'ADMIN' : 'USER'}
                                        </span>

                                        {/* Toggle Admin */}
                                        <button
                                            onClick={() => toggleAdminStatus(profile.id, profile.is_admin)}
                                            disabled={profile.id === user?.id}
                                            className={cn(
                                                "p-2 rounded-xl border flex items-center justify-center transition-colors",
                                                profile.is_admin
                                                    ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                                                    : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100",
                                                profile.id === user?.id && "opacity-50 cursor-not-allowed"
                                            )}
                                            title={profile.is_admin ? "Gỡ quyền Admin" : "Cấp quyền Admin"}
                                        >
                                            {profile.is_admin ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                                        </button>

                                        {/* Lock / Unlock */}
                                        <button
                                            onClick={() => toggleLock(profile.id, profile.is_locked)}
                                            disabled={profile.id === user?.id}
                                            className={cn(
                                                "p-2 rounded-xl border flex items-center justify-center transition-colors",
                                                profile.is_locked
                                                    ? "bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100"
                                                    : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-500",
                                                profile.id === user?.id && "opacity-50 cursor-not-allowed"
                                            )}
                                            title={profile.is_locked ? "Mở khoá tài khoản" : "Khoá tài khoản"}
                                        >
                                            {profile.is_locked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
