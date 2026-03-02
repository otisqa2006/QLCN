import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFarmContext } from '../contexts/FarmContext';
import { Landmark, LogIn, Loader2, ArrowRight, MapPin, CalendarDays, Plus, X } from 'lucide-react';

export function Login() {
    const { user, loading: authLoading } = useAuth();
    const { farms, seasons, currentFarm, currentSeason, setCurrentFarm, setCurrentSeason, loadingFarms, refreshData } = useFarmContext();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSignUp, setIsSignUp] = useState(false);
    const [readyToEnter, setReadyToEnter] = useState(false);

    // New Farm form
    const [showNewFarm, setShowNewFarm] = useState(false);
    const [newFarmName, setNewFarmName] = useState('');
    const [newFarmLocation, setNewFarmLocation] = useState('');
    const [savingFarm, setSavingFarm] = useState(false);

    // New Season form
    const [showNewSeason, setShowNewSeason] = useState(false);
    const [newSeasonName, setNewSeasonName] = useState('');
    const [newSeasonYear, setNewSeasonYear] = useState(new Date().getFullYear());
    const [savingSeason, setSavingSeason] = useState(false);

    // If ready, redirect
    if (user && readyToEnter) {
        return <Navigate to="/" replace />;
    }

    // Prevent flickers while checking session
    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                alert('Đăng ký thành công! Đang tự động đăng nhập...');
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            }
        } catch (err: any) {
            setError(err.message || 'Đã có lỗi xảy ra.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateFarm = async () => {
        if (!newFarmName.trim() || !user) return;
        setSavingFarm(true);
        const { data, error } = await supabase
            .from('farms')
            .insert({ name: newFarmName.trim(), location: newFarmLocation.trim() || null, user_id: user.id })
            .select()
            .single();
        if (!error && data) {
            await refreshData();
            setCurrentFarm(data);
            setNewFarmName('');
            setNewFarmLocation('');
            setShowNewFarm(false);
        } else {
            alert('Lỗi tạo vườn: ' + error?.message);
        }
        setSavingFarm(false);
    };

    const handleCreateSeason = async () => {
        if (!newSeasonName.trim() || !currentFarm || !user) return;
        setSavingSeason(true);
        const { data, error } = await supabase
            .from('harvest_seasons')
            .insert({
                name: newSeasonName.trim(),
                year: newSeasonYear,
                farm_id: currentFarm.id,
                user_id: user.id,
                status: 'IN_PROGRESS',
            })
            .select()
            .single();
        if (!error && data) {
            await refreshData();
            setCurrentSeason(data);
            setNewSeasonName('');
            setShowNewSeason(false);
        } else {
            alert('Lỗi tạo mùa vụ: ' + error?.message);
        }
        setSavingSeason(false);
    };

    return (
        <div className="min-h-screen flex flex-col justify-center px-6 py-12 bg-slate-50 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-[-10%] right-[-10%] w-64 h-64 rounded-full bg-emerald-300 blur-3xl opacity-20 pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 rounded-full bg-blue-300 blur-3xl opacity-20 pointer-events-none" />

            <div className="w-full max-w-sm mx-auto relative z-10">
                <div className="mb-10 text-center">
                    <div className="mx-auto w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-emerald-600 mb-6">
                        <Landmark className="w-8 h-8" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">QLCN Sầu Riêng</h2>
                    <p className="mt-2 text-sm text-slate-500 font-medium">
                        {user ? 'Bước 2: Chọn Khu Vườn & Mùa Vụ' : 'Đăng nhập để quản lý dòng tiền'}
                    </p>
                </div>

                {!user ? (
                    <form className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 rounded-3xl border border-slate-100 space-y-6" onSubmit={handleAuth}>
                        {error && (
                            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-sm font-medium text-center border border-rose-100">
                                {error}
                            </div>
                        )}
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                                <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                                    placeholder="nongdan@dakrmang.com" />
                            </div>
                            <div>
                                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1">Mật khẩu</label>
                                <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                                    placeholder="••••••••" />
                            </div>
                        </div>
                        <button type="submit" disabled={loading}
                            className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-slate-900/20 transition-all active:scale-[0.98] disabled:opacity-70">
                            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogIn className="w-5 h-5" />}
                            {isSignUp ? 'Tạo Tài Khoản' : 'Mở Khóa'}
                        </button>
                        <div className="text-center pt-2">
                            <button type="button" onClick={() => setIsSignUp(!isSignUp)}
                                className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
                                {isSignUp ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký ngay'}
                            </button>
                        </div>
                    </form>
                ) : (
                    /* Step 2: Select Farm and Season */
                    <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 rounded-3xl border border-slate-100 space-y-5">
                        {loadingFarms ? (
                            <div className="flex flex-col flex-1 items-center justify-center py-10 space-y-4">
                                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                                <p className="text-slate-500 font-medium">Đang tải dữ liệu vườn...</p>
                            </div>
                        ) : (
                            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">

                                {/* === FARM SECTION === */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-emerald-600" />
                                            Khu Vườn
                                        </label>
                                        {!showNewFarm && (
                                            <button onClick={() => setShowNewFarm(true)}
                                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition-all border border-emerald-200">
                                                <Plus className="w-3 h-3" /> Tạo mới
                                            </button>
                                        )}
                                    </div>

                                    {farms.length > 0 && !showNewFarm && (
                                        <select
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold appearance-none"
                                            value={currentFarm?.id || ''}
                                            onChange={(e) => {
                                                const farm = farms.find(f => f.id === e.target.value);
                                                setCurrentFarm(farm || null);
                                            }}
                                        >
                                            <option value="" disabled>-- Chọn Khu Vườn --</option>
                                            {farms.map(f => (
                                                <option key={f.id} value={f.id}>{f.name}</option>
                                            ))}
                                        </select>
                                    )}

                                    {farms.length === 0 && !showNewFarm && (
                                        <p className="text-sm bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-amber-700 font-medium">
                                            Chưa có vườn nào. Nhấn <strong>+ Tạo mới</strong> bên trên!
                                        </p>
                                    )}

                                    {showNewFarm && (
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Vườn mới</p>
                                                <button onClick={() => setShowNewFarm(false)}><X className="w-4 h-4 text-slate-400" /></button>
                                            </div>
                                            <input type="text" placeholder="Tên vườn *" value={newFarmName}
                                                onChange={e => setNewFarmName(e.target.value)} autoFocus
                                                onKeyDown={e => e.key === 'Enter' && handleCreateFarm()}
                                                className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                            <input type="text" placeholder="Địa điểm (tùy chọn)" value={newFarmLocation}
                                                onChange={e => setNewFarmLocation(e.target.value)}
                                                className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                            <button onClick={handleCreateFarm} disabled={!newFarmName.trim() || savingFarm}
                                                className="w-full py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2">
                                                {savingFarm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                                Tạo Vườn
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* === SEASON SECTION === */}
                                {currentFarm && (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                                <CalendarDays className="w-4 h-4 text-blue-600" />
                                                Mùa Vụ
                                            </label>
                                            {!showNewSeason && (
                                                <button onClick={() => setShowNewSeason(true)}
                                                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-all border border-blue-200">
                                                    <Plus className="w-3 h-3" /> Tạo mới
                                                </button>
                                            )}
                                        </div>

                                        {seasons.length > 0 && !showNewSeason && (
                                            <select
                                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold appearance-none"
                                                value={currentSeason?.id || ''}
                                                onChange={(e) => {
                                                    const season = seasons.find(s => s.id === e.target.value);
                                                    setCurrentSeason(season || null);
                                                }}
                                            >
                                                <option value="" disabled>-- Chọn Mùa Vụ --</option>
                                                {seasons.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name} ({s.year})</option>
                                                ))}
                                            </select>
                                        )}

                                        {seasons.length === 0 && !showNewSeason && (
                                            <p className="text-sm bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-blue-700 font-medium">
                                                Chưa có mùa vụ. Nhấn <strong>+ Tạo mới</strong> bên trên!
                                            </p>
                                        )}

                                        {showNewSeason && (
                                            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">Mùa vụ mới</p>
                                                    <button onClick={() => setShowNewSeason(false)}><X className="w-4 h-4 text-slate-400" /></button>
                                                </div>
                                                <input type="text" placeholder="Tên mùa vụ (VD: Vụ 1) *" value={newSeasonName}
                                                    onChange={e => setNewSeasonName(e.target.value)} autoFocus
                                                    onKeyDown={e => e.key === 'Enter' && handleCreateSeason()}
                                                    className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400" />
                                                <input type="number" placeholder="Năm" value={newSeasonYear}
                                                    onChange={e => setNewSeasonYear(Number(e.target.value))}
                                                    className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400" />
                                                <button onClick={handleCreateSeason} disabled={!newSeasonName.trim() || savingSeason}
                                                    className="w-full py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-2">
                                                    {savingSeason ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                                    Tạo Mùa Vụ
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={() => setReadyToEnter(true)}
                                    disabled={!currentFarm || !currentSeason}
                                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-40 mt-2"
                                >
                                    Vào Ứng Dụng
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
