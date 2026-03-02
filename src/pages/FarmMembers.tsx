import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFarmContext } from '../contexts/FarmContext';
import type { FarmPermissions } from '../contexts/FarmContext';
import { Users, Plus, Loader2, RefreshCw, ShieldCheck, Tractor, Wrench, Trash2, UserPlus, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

interface Member {
    id: string;
    user_id: string;
    role: 'OWNER' | 'MANAGER' | 'WORKER';
    permissions: FarmPermissions;
    profiles: {
        email: string;
        full_name: string | null;
    } | null;
}

const FEATURES: { key: keyof FarmPermissions; label: string }[] = [
    { key: 'dashboard', label: 'Tổng quan' },
    { key: 'expenses', label: 'Chi tiêu' },
    { key: 'harvest', label: 'Thu hoạch' },
    { key: 'capital', label: 'Vốn' },
    { key: 'debts', label: 'Sổ nợ' },
    { key: 'inventory', label: 'Kho vật tư' },
    { key: 'labor', label: 'Nhân công' },
    { key: 'diary', label: 'Nông vụ' },
    { key: 'expense_categories', label: 'Loại chi' },
    { key: 'withdraw', label: 'Rút vốn' },
];

const ROLE_ICONS: Record<string, typeof ShieldCheck> = {
    OWNER: ShieldCheck,
    MANAGER: Wrench,
    WORKER: Tractor,
};

const ROLE_LABELS: Record<string, string> = {
    OWNER: 'Chủ vườn',
    MANAGER: 'Quản lý',
    WORKER: 'Nhân công',
};

export function FarmMembers() {
    const { user, isAdmin } = useAuth();
    const { currentFarm, currentFarmRole } = useFarmContext();
    const navigate = useNavigate();
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null); // member id being saved

    // Invite form
    const [showInvite, setShowInvite] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'MANAGER' | 'WORKER'>('WORKER');
    const [inviting, setInviting] = useState(false);
    const [inviteError, setInviteError] = useState('');

    const canManage = currentFarmRole === 'OWNER' || isAdmin;

    useEffect(() => {
        if (!currentFarm) { navigate('/farm-select'); return; }
        if (!canManage) { navigate('/'); return; }
        fetchMembers();
    }, [currentFarm?.id]);

    const [fetchError, setFetchError] = useState<string | null>(null);

    const fetchMembers = async () => {
        if (!currentFarm) return;
        setLoading(true);
        setFetchError(null);

        // Step 1: fetch farm_members
        const { data: membersData, error: membersError } = await supabase
            .from('farm_members')
            .select('id, user_id, role, permissions, created_at')
            .eq('farm_id', currentFarm.id)
            .order('created_at', { ascending: true });

        if (membersError) {
            console.error('fetchMembers error:', membersError);
            setFetchError(membersError.message);
            setLoading(false);
            return;
        }

        if (!membersData || membersData.length === 0) {
            setMembers([]);
            setLoading(false);
            return;
        }

        // Step 2: fetch profiles for those user_ids
        const userIds = membersData.map(m => m.user_id);
        const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, email, full_name')
            .in('id', userIds);

        const profileMap: Record<string, { email: string; full_name: string | null }> = {};
        (profilesData || []).forEach(p => { profileMap[p.id] = p; });

        // Merge
        const merged: Member[] = membersData.map(m => ({
            id: m.id,
            user_id: m.user_id,
            role: m.role,
            permissions: m.permissions,
            profiles: profileMap[m.user_id] || null,
        }));

        setMembers(merged);
        setLoading(false);
    };

    const handleInvite = async () => {
        if (!inviteEmail.trim() || !currentFarm) return;
        setInviting(true);
        setInviteError('');
        const { data, error } = await supabase.rpc('invite_user_to_farm', {
            p_farm_id: currentFarm.id,
            p_email: inviteEmail.trim(),
            p_role: inviteRole,
        });

        if (error || data?.error) {
            setInviteError(data?.error || error?.message || 'Lỗi không xác định');
        } else {
            setShowInvite(false);
            setInviteEmail('');
            fetchMembers();
        }
        setInviting(false);
    };

    const handlePermissionToggle = async (member: Member, feature: keyof FarmPermissions) => {
        if (!canManage || member.role === 'OWNER') return;
        const newPerms = { ...member.permissions, [feature]: !member.permissions[feature] };

        // Optimistic update
        setMembers(prev => prev.map(m => m.id === member.id ? { ...m, permissions: newPerms } : m));
        setSaving(member.id);

        const { data } = await supabase.rpc('update_farm_member_permissions', {
            p_member_id: member.id,
            p_permissions: newPerms,
        });

        if (data?.error) {
            // revert on error
            fetchMembers();
        }
        setSaving(null);
    };

    const handleRemoveMember = async (member: Member) => {
        if (!canManage || member.role === 'OWNER') return;
        if (!confirm(`Xoá ${member.profiles?.email} khỏi vườn?`)) return;
        await supabase.from('farm_members').delete().eq('id', member.id);
        fetchMembers();
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 pb-24 pt-4 px-4">
            <div className="max-w-2xl mx-auto space-y-5 mt-4">

                {/* Header */}
                <div className="bg-gradient-to-br from-emerald-900 to-slate-800 rounded-3xl p-6 shadow-xl text-white">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
                            <Users className="w-7 h-7 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight">Thành Viên Vườn</h1>
                            <p className="text-sm text-slate-300 mt-1 font-medium">{currentFarm?.name}</p>
                        </div>
                    </div>
                </div>

                {/* Invite button */}
                {canManage && (
                    showInvite ? (
                        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-slate-800">Mời thành viên</h3>
                                <button onClick={() => { setShowInvite(false); setInviteError(''); }}><X className="w-5 h-5 text-slate-400" /></button>
                            </div>
                            <input type="email" placeholder="Email người dùng" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                                autoFocus onKeyDown={e => e.key === 'Enter' && handleInvite()} />
                            <div className="flex gap-2">
                                {(['MANAGER', 'WORKER'] as const).map(r => (
                                    <button key={r} onClick={() => setInviteRole(r)}
                                        className={cn("flex-1 py-2 rounded-xl text-sm font-bold transition-all",
                                            inviteRole === r ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                                        {ROLE_LABELS[r]}
                                    </button>
                                ))}
                            </div>
                            {inviteError && <p className="text-rose-500 text-xs font-medium bg-rose-50 p-2 rounded-lg">{inviteError}</p>}
                            <button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting}
                                className="w-full py-3 rounded-xl font-bold text-sm bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 flex items-center justify-center gap-2">
                                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                Gửi Lời Mời
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setShowInvite(true)}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-white rounded-2xl border-2 border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 font-bold text-sm transition-all shadow-sm">
                            <Plus className="w-4 h-4" /> Mời thành viên mới
                        </button>
                    )
                )}

                {/* Error state */}
                {fetchError && (
                    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-600 font-medium">
                        Lỗi tải danh sách: {fetchError}
                    </div>
                )}

                {/* Empty state */}
                {!fetchError && members.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-6">Chưa có thành viên nào trong vườn.</p>
                )}

                {/* Members list with permission matrix */}
                {members.map(member => {
                    const RoleIcon = ROLE_ICONS[member.role] || Tractor;
                    const isOwner = member.role === 'OWNER';
                    const isCurrentUser = member.user_id === user?.id;
                    return (
                        <div key={member.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
                            {/* Member header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center", isOwner ? "bg-emerald-100" : "bg-slate-100")}>
                                        <RoleIcon className={cn("w-5 h-5", isOwner ? "text-emerald-600" : "text-slate-500")} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-slate-800 text-sm">{member.profiles?.full_name || member.profiles?.email}</p>
                                            {isCurrentUser && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Bạn</span>}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full",
                                                isOwner ? "text-emerald-700 bg-emerald-100" : "text-slate-600 bg-slate-100")}>
                                                {ROLE_LABELS[member.role]}
                                            </span>
                                            <p className="text-xs text-slate-400">{member.profiles?.email}</p>
                                        </div>
                                    </div>
                                </div>
                                {canManage && !isOwner && (
                                    <div className="flex items-center gap-2">
                                        {saving === member.id && <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />}
                                        <button onClick={() => handleRemoveMember(member)}
                                            className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Permissions matrix */}
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Quyền tính năng</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {FEATURES.map(feat => {
                                        const hasPermission = isOwner || member.permissions?.[feat.key];
                                        return (
                                            <button
                                                key={feat.key}
                                                onClick={() => canManage && !isOwner && handlePermissionToggle(member, feat.key)}
                                                disabled={!canManage || isOwner}
                                                className={cn(
                                                    "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left",
                                                    hasPermission
                                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                        : "bg-slate-50 text-slate-400 border border-slate-100",
                                                    canManage && !isOwner ? "cursor-pointer hover:scale-[1.02] active:scale-[0.98]" : "cursor-default"
                                                )}
                                            >
                                                <span className={cn("w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-black flex-shrink-0",
                                                    hasPermission ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400")}>
                                                    {hasPermission ? '✓' : '–'}
                                                </span>
                                                {feat.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Refresh button */}
                <div className="flex justify-center">
                    <button onClick={fetchMembers} className="flex items-center gap-2 text-sm text-slate-500 font-medium hover:text-slate-700">
                        <RefreshCw className="w-4 h-4" /> Làm mới danh sách
                    </button>
                </div>
            </div>
        </div>
    );
}
