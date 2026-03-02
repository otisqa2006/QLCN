import { useState, useEffect } from 'react';
import {
    Droplet, Sprout, Bug, CalendarSearch,
    WifiOff, Wifi, Plus, Loader2, Save
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFarmContext } from '../contexts/FarmContext';
import { saveLogToOfflineQueue, getOfflineLogs, removeLogFromQueue } from '../lib/idb';

const ACTION_TYPES = [
    { id: 'TUOI_NUOC', label: 'Tưới nước', icon: Droplet, color: 'text-blue-500', bg: 'bg-blue-100' },
    { id: 'BON_PHAN', label: 'Bón phân', icon: Sprout, color: 'text-emerald-500', bg: 'bg-emerald-100' },
    { id: 'XIT_NAM', label: 'Xịt nấm', icon: Bug, color: 'text-rose-500', bg: 'bg-rose-100' },
    { id: 'XIT_MOT', label: 'Xịt mọt', icon: Bug, color: 'text-amber-500', bg: 'bg-amber-100' },
    { id: 'XIT_NHEN', label: 'Xịt nhện', icon: Bug, color: 'text-orange-500', bg: 'bg-orange-100' },
    { id: 'KEO_DOT', label: 'Kéo đọt', icon: Sprout, color: 'text-indigo-500', bg: 'bg-indigo-100' },
    { id: 'LAM_BONG', label: 'Làm bông', icon: CalendarSearch, color: 'text-pink-500', bg: 'bg-pink-100' },
];

export function FarmDiary() {
    const { user } = useAuth();
    const { currentFarm, currentSeason } = useFarmContext();

    // Offline State
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [offlineCount, setOfflineCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    // Data State
    const [plots, setPlots] = useState<any[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const [recentLogs, setRecentLogs] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    // Form State
    const [selectedPlotId, setSelectedPlotId] = useState<string>('');
    const [selectedActionId, setSelectedActionId] = useState<string>('TUOI_NUOC');
    const [notes, setNotes] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Materials Selection State
    const [selectedMaterials, setSelectedMaterials] = useState<Array<{ id: string, qty: string }>>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- Network & Offline Sync Logic ---
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        checkOfflineQueue(); // Check on load

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        if (isOnline) {
            syncOfflineData();
        }
    }, [isOnline]);

    const checkOfflineQueue = async () => {
        const logs = await getOfflineLogs();
        setOfflineCount(logs.length);
    };

    const syncOfflineData = async () => {
        if (!user || isSyncing) return;

        setIsSyncing(true);
        try {
            const queue = await getOfflineLogs();
            if (queue.length === 0) return;

            console.log(`Bắt đầu đồng bộ ${queue.length} bản ghi chưa lưu...`);

            for (const log of queue) {
                // 1. Insert Log
                const { data: newLog, error: logError } = await supabase
                    .from('farm_logs')
                    .insert({
                        user_id: log.user_id,
                        farm_id: log.farm_id ?? null,
                        season_id: log.season_id ?? null,
                        plot_id: log.plot_id,
                        action_type: log.action_type,
                        notes: log.notes,
                        date: log.date
                    })
                    .select('id')
                    .single();

                if (logError) throw logError;

                // 2. Insert Materials
                if (log.materials && log.materials.length > 0) {
                    const materialsToInsert = log.materials.map(m => ({
                        log_id: newLog.id,
                        inventory_item_id: m.inventory_item_id,
                        quantity_used: m.quantity_used
                    }));

                    const { error: matError } = await supabase
                        .from('log_materials')
                        .insert(materialsToInsert);

                    if (matError) throw matError;
                }

                // 3. Xóa khỏi Queue
                await removeLogFromQueue(log.id);
            }

            checkOfflineQueue();
            loadInitialData(); // Reload UI data after sync
            alert('Đã đồng bộ dữ liệu Offline thành công!');

        } catch (error) {
            console.error('Lỗi khi đồng bộ:', error);
        } finally {
            setIsSyncing(false);
        }
    };

    // --- Data Loading ---
    const loadInitialData = async () => {
        if (!user) return;
        setLoadingData(true);
        try {
            // Load Plots
            const { data: pData } = await supabase.from('plots').select('*').eq('farm_id', currentFarm?.id ?? '').order('name');
            if (pData) {
                setPlots(pData);
                if (pData.length > 0) setSelectedPlotId(pData[0].id);
            }

            // Load Inventory for dropdown
            const { data: iData } = await supabase.from('inventory_items').select('id, name, unit, stock_quantity').eq('farm_id', currentFarm?.id ?? '');
            if (iData) setInventory(iData);

            // Load Recent Logs (Timeline)
            const { data: lData } = await supabase
                .from('farm_logs')
                .select(`
                    id, date, action_type, notes,
                    plots ( name ),
                    log_materials (
                        quantity_used,
                        inventory_items ( name, unit )
                    )
                `)
                .eq('farm_id', currentFarm?.id ?? '')
                .eq('season_id', currentSeason?.id ?? '')
                .order('date', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(10);

            if (lData) setRecentLogs(lData);

        } catch (err) {
            console.log(err);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        if (isOnline) {
            loadInitialData();
        } else {
            // If offline on initial load, skip Supabase fetch. 
            // In a real PWA, you might cache the plots/inventory locally too.
            setLoadingData(false);
        }
    }, [user, isOnline]);

    // --- Form Actions ---
    const handleAddMaterial = () => {
        if (inventory.length === 0) return;
        setSelectedMaterials([...selectedMaterials, { id: inventory[0].id, qty: '' }]);
    };

    const handleUpdateMaterial = (index: number, field: 'id' | 'qty', value: string) => {
        const updated = [...selectedMaterials];
        updated[index] = { ...updated[index], [field]: value };
        setSelectedMaterials(updated);
    };

    const handleRemoveMaterial = (index: number) => {
        setSelectedMaterials(selectedMaterials.filter((_, i) => i !== index));
    };

    const handleSaveLog = async () => {
        if (!selectedPlotId) return alert('Vui lòng chọn lô đất');

        // Validate Materials
        const validMaterials = selectedMaterials.filter(m => m.id && Number(m.qty) > 0);

        const payload = {
            id: crypto.randomUUID(), // Temp ID for offline
            user_id: user!.id,
            farm_id: currentFarm?.id ?? null,
            season_id: currentSeason?.id ?? null,
            plot_id: selectedPlotId,
            action_type: selectedActionId,
            notes,
            date,
            materials: validMaterials.map(m => ({
                inventory_item_id: m.id,
                quantity_used: Number(m.qty)
            })),
            timestamp: Date.now()
        };

        setIsSubmitting(true);

        if (!isOnline) {
            // --- OFFLINE SAVE ---
            await saveLogToOfflineQueue(payload);
            setOfflineCount(prev => prev + 1);
            alert('Đã lưu vào bộ nhớ tạm (Offline). Sẽ đồng bộ khi có mạng.');

            // Optimistic UI Update (Mock log object for UI)
            const mockLog = {
                id: payload.id,
                date: payload.date,
                action_type: payload.action_type,
                notes: payload.notes,
                plots: { name: plots.find(p => p.id === payload.plot_id)?.name || 'Lô tạm' },
                log_materials: payload.materials.map(m => ({
                    quantity_used: m.quantity_used,
                    inventory_items: {
                        name: inventory.find(i => i.id === m.inventory_item_id)?.name || 'Vật tư',
                        unit: inventory.find(i => i.id === m.inventory_item_id)?.unit || ''
                    }
                }))
            };
            setRecentLogs([mockLog, ...recentLogs]);
            resetForm();
            setIsSubmitting(false);

        } else {
            // --- ONLINE SAVE ---
            try {
                // 1. Insert Log
                const { data: newLog, error: logError } = await supabase
                    .from('farm_logs')
                    .insert({
                        user_id: payload.user_id,
                        farm_id: payload.farm_id,
                        season_id: payload.season_id,
                        plot_id: payload.plot_id,
                        action_type: payload.action_type,
                        notes: payload.notes,
                        date: payload.date
                    })
                    .select('id')
                    .single();

                if (logError) throw logError;

                // 2. Insert Materials
                if (payload.materials.length > 0) {
                    const materialsToInsert = payload.materials.map(m => ({
                        log_id: newLog.id,
                        inventory_item_id: m.inventory_item_id,
                        quantity_used: m.quantity_used
                    }));

                    const { error: matError } = await supabase
                        .from('log_materials')
                        .insert(materialsToInsert);

                    if (matError) throw matError;
                }

                alert('Đã lưu Nhật ký thành công!');
                loadInitialData(); // Refresh list & inventory
                resetForm();

            } catch (err: any) {
                console.error(err);
                alert('Lỗi khi lưu: ' + err.message);
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const resetForm = () => {
        setNotes('');
        setSelectedMaterials([]);
        // Keep selected plot, action and date as they often do multiple logs in a row
    };

    if (loadingData && isOnline) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4 pt-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <p className="text-slate-500 font-medium">Đang tải biểu mẫu...</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6 pb-24 h-full overflow-y-auto bg-slate-50">
            {/* Header & Network Badge */}
            <div className="flex items-center justify-between mt-4 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Nông Vụ</h1>
                    <p className="text-slate-500 text-sm mt-1">Sổ tay ghi chép tại vườn</p>
                </div>

                <div className="flex flex-col items-end gap-1">
                    {isOnline ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                            <Wifi className="w-3.5 h-3.5" />
                            Đang Online
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold animate-pulse">
                            <WifiOff className="w-3.5 h-3.5" />
                            Đang Offline
                        </div>
                    )}

                    {offlineCount > 0 && (
                        <span className="text-[10px] font-semibold text-amber-600">
                            {offlineCount} bản ghi chưa đồng bộ
                        </span>
                    )}
                </div>
            </div>

            {isSyncing && (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang đồng bộ dữ liệu Offline lên máy chủ...
                </div>
            )}

            {/* Input Form Card */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-5">

                {/* 1. Chọn Lô */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Khu vực / Lô</label>
                    <div className="flex gap-2">
                        {plots.length === 0 && !isOnline && (
                            <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-xl w-full">
                                Cần kết nối mạng lần đầu để tải danh sách lô đất.
                            </div>
                        )}
                        {plots.map(plot => (
                            <button
                                key={plot.id}
                                onClick={() => setSelectedPlotId(plot.id)}
                                className={cn(
                                    "flex-1 py-3 px-2 rounded-xl text-sm font-bold border-2 transition-all",
                                    selectedPlotId === plot.id
                                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                        : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"
                                )}
                            >
                                {plot.name} <br />
                                <span className={cn("text-[10px] font-normal", selectedPlotId === plot.id ? "text-emerald-600" : "text-slate-400")}>
                                    ({plot.tree_count} {plot.tree_type})
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. Chọn Hành động */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Công việc</label>
                    <div className="grid grid-cols-4 gap-2">
                        {ACTION_TYPES.map(action => {
                            const Icon = action.icon;
                            const isSelected = selectedActionId === action.id;
                            return (
                                <button
                                    key={action.id}
                                    onClick={() => setSelectedActionId(action.id)}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all active:scale-95",
                                        isSelected ? `border-${action.color.split('-')[1]}-500 ${action.bg}` : "border-transparent bg-slate-50 hover:bg-slate-100"
                                    )}
                                >
                                    <Icon className={cn("w-5 h-5 mb-1.5", isSelected ? action.color : "text-slate-400")} />
                                    <span className={cn("text-[10px] font-bold text-center leading-tight", isSelected ? action.color : "text-slate-500")}>
                                        {action.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 3. Ngày thực hiện */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ngày thực hiện</label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-semibold text-slate-700 outline-none focus:border-emerald-500"
                    />
                </div>

                {/* 4. Vật tư */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vật tư sử dụng</label>
                        <button
                            onClick={handleAddMaterial}
                            className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                        >
                            <Plus className="w-3 h-3" /> Thêm
                        </button>
                    </div>

                    {selectedMaterials.length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center py-2 bg-slate-50 rounded-xl">Không dùng vật tư</p>
                    ) : (
                        <div className="space-y-2">
                            {selectedMaterials.map((mat, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <select
                                        value={mat.id}
                                        onChange={(e) => handleUpdateMaterial(idx, 'id', e.target.value)}
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 min-w-0"
                                    >
                                        {inventory.map(item => (
                                            <option key={item.id} value={item.id}>
                                                {item.name} (Tồn: {item.stock_quantity})
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        placeholder="SL"
                                        value={mat.qty}
                                        onChange={(e) => handleUpdateMaterial(idx, 'qty', e.target.value)}
                                        className="w-20 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-center outline-none focus:border-emerald-500"
                                    />
                                    <button
                                        onClick={() => handleRemoveMaterial(idx)}
                                        className="bg-rose-50 text-rose-500 rounded-xl px-3 flex items-center justify-center hover:bg-rose-100"
                                    >
                                        X
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 5. Ghi chú */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ghi chú (Tùy chọn)</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Chuẩn bị thời tiết mưa, nắng..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500 min-h-[80px]"
                    />
                </div>

                <button
                    onClick={handleSaveLog}
                    disabled={isSubmitting || !selectedPlotId}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> {isOnline ? 'Lưu Nhật Ký' : 'Lưu Tạm (Offline)'}</>}
                </button>
            </div>

            {/* Timeline Lịch sử */}
            <div className="pt-4">
                <h3 className="font-bold text-slate-900 mb-4 px-1 tracking-tight">Gần đây</h3>

                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">

                    {recentLogs.length === 0 ? (
                        <p className="text-center text-sm text-slate-400">Chưa có ghi chép nào.</p>
                    ) : recentLogs.map((log) => {
                        const actionConfig = ACTION_TYPES.find(a => a.id === log.action_type) || ACTION_TYPES[0];
                        const Icon = actionConfig.icon;

                        return (
                            <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                {/* Icon Bubble */}
                                <div className={cn(
                                    "flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-50 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10",
                                    actionConfig.bg, actionConfig.color
                                )}>
                                    <Icon className="w-4 h-4" />
                                </div>

                                {/* Content Card */}
                                <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={cn("text-xs font-bold px-2 py-0.5 rounded text-white", actionConfig.color.replace('text', 'bg'))}>
                                            {actionConfig.label}
                                        </span>
                                        <span className="text-[10px] font-semibold text-slate-400">
                                            {new Date(log.date).toLocaleDateString('vi-VN')}
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-slate-800 text-sm mt-1 mb-2">{log.plots?.name || 'Khu vực'}</h4>

                                    {log.notes && (
                                        <p className="text-xs text-slate-500 mb-2 italic">"{log.notes}"</p>
                                    )}

                                    {log.log_materials && log.log_materials.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                                            {log.log_materials.map((mat: any, idx: number) => (
                                                <div key={idx} className="flex justify-between text-xs">
                                                    <span className="text-slate-600 font-medium">+ {mat.inventory_items?.name}</span>
                                                    <span className="text-slate-800 font-bold">{mat.quantity_used} <span className="text-slate-400 font-normal">{mat.inventory_items?.unit}</span></span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                </div>
            </div>
        </div>
    );
}
