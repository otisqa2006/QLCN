import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFarmContext } from '../contexts/FarmContext';
import type { Farm, Season } from '../contexts/FarmContext';
import { MapPin, Plus, ChevronRight, CalendarDays, Loader2, X, Leaf } from 'lucide-react';
import { cn } from '../lib/utils';

type Step = 'farm' | 'season';

export function FarmSelect() {
    const { user } = useAuth();
    const { farms, setCurrentFarm, setCurrentSeason, refreshData, loadingFarms } = useFarmContext();
    const navigate = useNavigate();

    const [step, setStep] = useState<Step>('farm');
    const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
    const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
    const [farmSeasons, setFarmSeasons] = useState<Season[]>([]);
    const [loadingSeasons, setLoadingSeasons] = useState(false);

    // New farm form
    const [showNewFarm, setShowNewFarm] = useState(false);
    const [newFarmName, setNewFarmName] = useState('');
    const [newFarmLocation, setNewFarmLocation] = useState('');
    const [savingFarm, setSavingFarm] = useState(false);

    // New season form
    const [showNewSeason, setShowNewSeason] = useState(false);
    const [newSeasonName, setNewSeasonName] = useState('');
    const [newSeasonYear, setNewSeasonYear] = useState(new Date().getFullYear());
    const [savingSeason, setSavingSeason] = useState(false);

    const handleFarmSelect = async (farm: Farm) => {
        setSelectedFarm(farm);
        setLoadingSeasons(true);
        const { data } = await supabase
            .from('harvest_seasons')
            .select('*')
            .eq('farm_id', farm.id)
            .order('year', { ascending: false });
        setFarmSeasons(data || []);
        setLoadingSeasons(false);
        setStep('season');
    };

    const handleSeasonSelect = (season: Season) => {
        setSelectedSeason(season);
    };

    const handleConfirm = () => {
        if (!selectedFarm || !selectedSeason) return;
        setCurrentFarm(selectedFarm);
        setCurrentSeason(selectedSeason);
        navigate('/');
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
            setNewFarmName('');
            setNewFarmLocation('');
            setShowNewFarm(false);
            handleFarmSelect(data);
        } else {
            alert('Lỗi tạo vườn: ' + error?.message);
        }
        setSavingFarm(false);
    };

    const handleCreateSeason = async () => {
        if (!newSeasonName.trim() || !selectedFarm || !user) return;
        setSavingSeason(true);
        const { data, error } = await supabase
            .from('harvest_seasons')
            .insert({
                name: newSeasonName.trim(),
                year: newSeasonYear,
                farm_id: selectedFarm.id,
                user_id: user.id,
                status: 'IN_PROGRESS',
            })
            .select()
            .single();

        if (!error && data) {
            setFarmSeasons(prev => [data, ...prev]);
            setNewSeasonName('');
            setShowNewSeason(false);
            setSelectedSeason(data);
        } else {
            alert('Lỗi tạo mùa vụ: ' + error?.message);
        }
        setSavingSeason(false);
    };

    if (loadingFarms) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-slate-900 flex flex-col items-center justify-start px-4 pt-16 pb-8">
            {/* Header */}
            <div className="w-full max-w-md mb-8 text-center">
                <div className="flex items-center justify-center w-16 h-16 bg-emerald-500/20 rounded-3xl mx-auto mb-5 border border-emerald-500/30">
                    <Leaf className="w-8 h-8 text-emerald-400" />
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight">
                    {step === 'farm' ? 'Chọn Khu Vườn' : `Mùa Vụ — ${selectedFarm?.name}`}
                </h1>
                <p className="text-sm text-slate-400 font-medium mt-2">
                    {step === 'farm' ? 'Chọn vườn bạn muốn quản lý' : 'Chọn mùa vụ để bắt đầu'}
                </p>
            </div>

            {/* Steps indicator */}
            <div className="flex items-center gap-3 mb-8">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold", step === 'farm' ? "bg-emerald-500 text-white" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30")}>1</div>
                <div className="w-12 h-0.5 bg-slate-700" />
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold", step === 'season' ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-500")}>2</div>
            </div>

            {/* Content */}
            <div className="w-full max-w-md space-y-3">
                {step === 'farm' && (
                    <>
                        {farms.map(farm => (
                            <button
                                key={farm.id}
                                onClick={() => handleFarmSelect(farm)}
                                className="w-full bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl p-4 flex items-center justify-between text-left transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                        <MapPin className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">{farm.name}</h3>
                                        {farm.location && <p className="text-xs text-slate-400 mt-0.5">{farm.location}</p>}
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-400" />
                            </button>
                        ))}

                        {farms.length === 0 && (
                            <div className="text-center py-8 text-slate-400">
                                <MapPin className="w-10 h-10 mx-auto mb-3 opacity-40" />
                                <p className="font-medium">Bạn chưa có vườn nào</p>
                                <p className="text-sm mt-1 opacity-70">Hãy tạo vườn đầu tiên!</p>
                            </div>
                        )}

                        {showNewFarm ? (
                            <div className="bg-white/10 border border-white/20 rounded-2xl p-4 space-y-3">
                                <input
                                    type="text"
                                    placeholder="Tên vườn (bắt buộc)"
                                    value={newFarmName}
                                    onChange={e => setNewFarmName(e.target.value)}
                                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    autoFocus
                                />
                                <input
                                    type="text"
                                    placeholder="Địa điểm (tuỳ chọn)"
                                    value={newFarmLocation}
                                    onChange={e => setNewFarmLocation(e.target.value)}
                                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                <div className="flex gap-2">
                                    <button onClick={() => setShowNewFarm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-400 border border-white/10 hover:bg-white/5">Huỷ</button>
                                    <button
                                        onClick={handleCreateFarm}
                                        disabled={!newFarmName.trim() || savingFarm}
                                        className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 flex items-center justify-center gap-1"
                                    >
                                        {savingFarm ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tạo Vườn'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowNewFarm(true)}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-white/20 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 font-bold text-sm transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                Tạo vườn mới
                            </button>
                        )}
                    </>
                )}

                {step === 'season' && (
                    <>
                        <button onClick={() => setStep('farm')} className="text-sm text-slate-400 hover:text-white flex items-center gap-1 mb-2 font-medium transition-colors">
                            <X className="w-4 h-4" /> Đổi vườn
                        </button>

                        {loadingSeasons ? (
                            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
                        ) : (
                            <>
                                {farmSeasons.map(season => (
                                    <button
                                        key={season.id}
                                        onClick={() => handleSeasonSelect(season)}
                                        className={cn(
                                            "w-full bg-white/10 hover:bg-white/15 border rounded-2xl p-4 flex items-center justify-between text-left transition-all",
                                            selectedSeason?.id === season.id ? "border-emerald-500 bg-emerald-500/20" : "border-white/10"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", selectedSeason?.id === season.id ? "bg-emerald-500" : "bg-slate-700")}>
                                                <CalendarDays className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white">{season.name}</h3>
                                                <p className="text-xs text-slate-400 mt-0.5">{season.year} • {season.status === 'IN_PROGRESS' ? '🌱 Đang chạy' : '✅ Đã kết thúc'}</p>
                                            </div>
                                        </div>
                                        {selectedSeason?.id === season.id && <div className="w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center"><span className="text-white text-xs font-black">✓</span></div>}
                                    </button>
                                ))}

                                {farmSeasons.length === 0 && (
                                    <div className="text-center py-6 text-slate-400">
                                        <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-40" />
                                        <p className="font-medium">Chưa có mùa vụ</p>
                                    </div>
                                )}

                                {showNewSeason ? (
                                    <div className="bg-white/10 border border-white/20 rounded-2xl p-4 space-y-3">
                                        <input type="text" placeholder="Tên mùa vụ (vd: Vụ 1)" value={newSeasonName} onChange={e => setNewSeasonName(e.target.value)}
                                            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500" autoFocus />
                                        <input type="number" placeholder="Năm" value={newSeasonYear} onChange={e => setNewSeasonYear(Number(e.target.value))}
                                            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                                        <div className="flex gap-2">
                                            <button onClick={() => setShowNewSeason(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-400 border border-white/10 hover:bg-white/5">Huỷ</button>
                                            <button onClick={handleCreateSeason} disabled={!newSeasonName.trim() || savingSeason}
                                                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 flex items-center justify-center gap-1">
                                                {savingSeason ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tạo Vụ'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={() => setShowNewSeason(true)}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-white/20 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 font-bold text-sm transition-all">
                                        <Plus className="w-4 h-4" /> Tạo mùa vụ mới
                                    </button>
                                )}

                                <button
                                    onClick={handleConfirm}
                                    disabled={!selectedSeason}
                                    className="w-full mt-4 py-4 rounded-2xl font-black text-base bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-40 transition-all shadow-xl shadow-emerald-900/50"
                                >
                                    Vào Trang Chủ →
                                </button>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
