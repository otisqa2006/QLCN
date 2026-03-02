import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Terminal, RefreshCw, ChevronLeft, Filter } from 'lucide-react';

interface LogEntry {
    id: string;
    user_id: string;
    farm_id: string | null;
    season_id: string | null;
    expense_id: string | null;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    amount: number | null;
    category: string | null;
    description: string | null;
    meta: Record<string, any> | null;
    created_at: string;
    profiles?: { email: string; full_name: string | null } | null;
    farms?: { name: string } | null;
}

const ACTION_COLOR: Record<string, string> = {
    CREATE: 'text-emerald-400',
    UPDATE: 'text-amber-400',
    DELETE: 'text-rose-400',
};

const ACTION_BG: Record<string, string> = {
    CREATE: 'bg-emerald-950 border-emerald-700',
    UPDATE: 'bg-amber-950 border-amber-700',
    DELETE: 'bg-rose-950 border-rose-700',
};

function formatTs(ts: string) {
    const d = new Date(ts);
    const date = d.toLocaleDateString('vi-VN');
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${date} ${time}`;
}

function formatVND(amount: number | null) {
    if (!amount) return '—';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export function ExpenseLogs() {
    const { user, isAdmin } = useAuth();
    const navigate = useNavigate();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'CREATE' | 'UPDATE' | 'DELETE'>('ALL');
    const [animReady, setAnimReady] = useState(false);
    const terminalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isAdmin) { navigate('/'); return; }
        setTimeout(() => setAnimReady(true), 100);
        fetchLogs();
    }, [isAdmin]);

    const fetchLogs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('expense_logs')
            .select(`
                id, user_id, farm_id, season_id, expense_id,
                action, amount, category, description, meta, created_at,
                profiles ( email, full_name ),
                farms ( name )
            `)
            .order('created_at', { ascending: false })
            .limit(200);

        if (!error && data) {
            setLogs(data as unknown as LogEntry[]);
        }
        setLoading(false);
        // Auto scroll to top
        setTimeout(() => terminalRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 100);
    };

    const filtered = logs.filter(l => filter === 'ALL' || l.action === filter);

    if (!isAdmin) return null;

    return (
        <div className="min-h-screen bg-black text-green-400 font-mono flex flex-col">
            {/* Top bar */}
            <div className="bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-lg shadow-black/50">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/utilities')}
                        className="text-zinc-500 hover:text-green-400 transition-colors p-1"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <Terminal className="w-5 h-5 text-green-500" />
                    <span className="text-green-400 font-bold tracking-widest text-sm uppercase">
                        QLCN :: EXPENSE_LOGS
                    </span>
                    <span className="text-zinc-600 text-xs">v1.0 [ADMIN ONLY]</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-zinc-600 text-xs hidden sm:block">{filtered.length} records</span>
                    <button
                        onClick={fetchLogs}
                        className="p-1.5 text-zinc-500 hover:text-green-400 transition-colors"
                        title="Reload"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Scan line animation bar */}
            <div className="h-px bg-gradient-to-r from-transparent via-green-500/50 to-transparent animate-pulse" />

            {/* Filter row */}
            <div className="bg-zinc-950/80 border-b border-zinc-800/60 px-4 py-2 flex items-center gap-2 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-zinc-600" />
                {(['ALL', 'CREATE', 'UPDATE', 'DELETE'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1 rounded text-[11px] font-bold tracking-widest uppercase border transition-all ${filter === f
                                ? f === 'ALL' ? 'bg-zinc-800 border-zinc-500 text-zinc-200'
                                    : f === 'CREATE' ? 'bg-emerald-950 border-emerald-600 text-emerald-400'
                                        : f === 'UPDATE' ? 'bg-amber-950 border-amber-600 text-amber-400'
                                            : 'bg-rose-950 border-rose-600 text-rose-400'
                                : 'bg-transparent border-zinc-800 text-zinc-600 hover:border-zinc-600'
                            }`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Terminal body */}
            <div
                ref={terminalRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-2"
                style={{ background: 'radial-gradient(ellipse at top, #0a1a0a 0%, #000000 100%)' }}
            >
                {/* Boot text */}
                <div className={`transition-opacity duration-700 ${animReady ? 'opacity-100' : 'opacity-0'} mb-6`}>
                    <p className="text-zinc-700 text-xs">{'>'} Connecting to QLCN audit subsystem...</p>
                    <p className="text-zinc-700 text-xs">{'>'} Authentication: <span className="text-green-600">ADMIN [{user?.email}]</span></p>
                    <p className="text-zinc-700 text-xs">{'>'} Streaming expense_logs table... {filtered.length} entries loaded.</p>
                    <p className="text-green-800 text-xs mt-1">{'>'} ─────────────────────────────</p>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-6 h-6 border-2 border-green-700 border-t-green-400 rounded-full animate-spin" />
                        <p className="text-green-800 text-xs animate-pulse">['loading'] fetching records...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 text-zinc-700 text-sm">
                        <Terminal className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p>no records found.</p>
                    </div>
                ) : filtered.map((log, idx) => (
                    <div
                        key={log.id}
                        className={`border rounded px-3 py-2.5 text-xs transition-all ${ACTION_BG[log.action]} hover:brightness-125`}
                        style={{ animationDelay: `${idx * 20}ms` }}
                    >
                        {/* Row header */}
                        <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-1 mb-1">
                            <span className={`font-black tracking-widest text-[11px] uppercase ${ACTION_COLOR[log.action]}`}>
                                [{log.action}]
                            </span>
                            <span className="text-zinc-600 text-[10px] tabular-nums">
                                {formatTs(log.created_at)}
                            </span>
                        </div>

                        {/* Data row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 mt-1">
                            <LogField label="user" value={log.profiles?.email ?? log.user_id.slice(0, 8) + '…'} />
                            <LogField label="farm" value={log.farms?.name ?? log.farm_id?.slice(0, 8) ?? '—'} />
                            <LogField label="amount" value={formatVND(log.amount)} color="text-cyan-400" />
                            <LogField label="category" value={log.category ?? '—'} />
                            {log.description && (
                                <LogField label="note" value={log.description} className="sm:col-span-2" />
                            )}
                            {log.meta && Object.keys(log.meta).length > 0 && (
                                <LogField
                                    label="meta"
                                    value={JSON.stringify(log.meta)}
                                    color="text-zinc-500"
                                    className="sm:col-span-2 truncate"
                                />
                            )}
                            <LogField label="id" value={log.expense_id ? log.expense_id.slice(0, 20) + '…' : 'DELETED'} color="text-zinc-700" />
                        </div>
                    </div>
                ))}

                {/* Footer */}
                {!loading && filtered.length > 0 && (
                    <p className="text-zinc-800 text-[10px] text-center pt-6 pb-2">
                        ─── end of log stream · {filtered.length} records ───
                    </p>
                )}
            </div>
        </div>
    );
}

function LogField({ label, value, color = 'text-zinc-300', className = '' }: { label: string; value: string; color?: string; className?: string }) {
    return (
        <div className={`flex gap-2 items-baseline ${className}`}>
            <span className="text-zinc-600 text-[10px] flex-shrink-0">{label}:</span>
            <span className={`${color} truncate`}>{value}</span>
        </div>
    );
}
