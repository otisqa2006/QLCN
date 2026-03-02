import { Link } from 'react-router-dom';
import { Landmark, NotebookTabs, Warehouse, Users, Leaf, LogOut, Tags, MapPin, CalendarDays, ArrowDownToLine, ShieldCheck, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFarmContext } from '../contexts/FarmContext';
import type { FarmPermissions } from '../contexts/FarmContext';
import { cn } from '../lib/utils';

export function Utilities() {
    const { isAdmin } = useAuth();
    const { currentFarmRole, currentFarmPermissions } = useFarmContext();
    const isOwnerOrAdmin = currentFarmRole === 'OWNER' || currentFarmRole === 'ADMIN' || isAdmin;
    const isPrivileged = isOwnerOrAdmin;

    const utilsKeys: { to: string; icon: any; label: string; desc: string; color: string; bg: string; permission?: keyof FarmPermissions }[] = [
        { to: '/farms', icon: MapPin, label: 'Khu Vườn', desc: 'Quản lý Đất đai', color: 'text-emerald-600', bg: 'bg-emerald-100' },
        { to: '/seasons', icon: CalendarDays, label: 'Mùa Vụ', desc: 'Quản lý các Vụ', color: 'text-blue-600', bg: 'bg-blue-100' },
        { to: '/capital', icon: Landmark, label: 'Quản lý Vốn', desc: 'Góp vốn, vay mượn', color: 'text-emerald-500', bg: 'bg-emerald-100', permission: 'capital' },
        { to: '/debts', icon: NotebookTabs, label: 'Sổ Nợ', desc: 'Công nợ đại lý', color: 'text-rose-500', bg: 'bg-rose-100', permission: 'debts' },
        { to: '/inventory', icon: Warehouse, label: 'Kho Vật Tư', desc: 'Phân thuốc, công cụ', color: 'text-amber-500', bg: 'bg-amber-100', permission: 'inventory' },
        { to: '/labor', icon: Users, label: 'Nhân Công', desc: 'Chấm công, ứng lương', color: 'text-blue-500', bg: 'bg-blue-100', permission: 'labor' },
        { to: '/harvest', icon: Leaf, label: 'Thu Hoạch', desc: 'Sản lượng, bán hàng', color: 'text-emerald-500', bg: 'bg-emerald-100', permission: 'harvest' },
        { to: '/expense-categories', icon: Tags, label: 'Loại Chi Tiêu', desc: 'Thêm/Xóa danh mục chi', color: 'text-indigo-500', bg: 'bg-indigo-100', permission: 'expense_categories' },
        { to: '/withdraw', icon: ArrowDownToLine, label: 'Rút Vốn', desc: 'Chuyển về Quỹ chi tiêu', color: 'text-indigo-600', bg: 'bg-indigo-100', permission: 'withdraw' },
    ];

    return (
        <div className="p-4 space-y-6 pb-32 h-full overflow-y-auto bg-slate-50">
            <header className="mt-4 mb-8">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tiện ích</h1>
                <p className="text-slate-500 text-sm mt-1">Các Module quản lý mở rộng</p>
            </header>

            {isAdmin && (
                <div className="mb-6">
                    <Link
                        to="/admin"
                        className="bg-gradient-to-r from-slate-900 to-slate-800 p-5 rounded-3xl shadow-sm text-white flex items-center gap-4 transition-transform active:scale-95"
                    >
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
                            <ShieldCheck className="w-8 h-8 text-emerald-400" strokeWidth={2} />
                        </div>
                        <div>
                            <h2 className="font-bold tracking-tight text-lg">Quản Trị Người Dùng</h2>
                            <p className="text-xs text-slate-300 mt-1 opacity-90">Khu vực dành riêng cho Admin</p>
                        </div>
                    </Link>
                </div>
            )}

            {isOwnerOrAdmin && (
                <div className="mb-6">
                    <Link
                        to="/farm-members"
                        className="bg-gradient-to-r from-emerald-800 to-emerald-700 p-5 rounded-3xl shadow-sm text-white flex items-center gap-4 transition-transform active:scale-95"
                    >
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
                            <Users className="w-8 h-8 text-emerald-300" strokeWidth={2} />
                        </div>
                        <div>
                            <h2 className="font-bold tracking-tight text-lg">Thành Viên Vườn</h2>
                            <p className="text-xs text-emerald-200 mt-1 opacity-90">Quản lý quyền sử dụng theo tính năng</p>
                        </div>
                    </Link>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                {utilsKeys.map((item) => {
                    const hasAccess = !item.permission || isPrivileged || currentFarmPermissions[item.permission];

                    return (
                        <Link
                            key={item.to}
                            to={item.to}
                            className={cn(
                                "bg-white p-5 rounded-3xl shadow-sm border flex flex-col items-center text-center justify-center space-y-3 transition-transform active:scale-95 relative overflow-hidden",
                                hasAccess
                                    ? "border-slate-100"
                                    : "border-slate-100 opacity-50 grayscale-[0.4]"
                            )}
                        >
                            {/* Lock overlay for restricted features */}
                            {!hasAccess && (
                                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                                    <div className="absolute inset-0 bg-white/60 rounded-3xl" />
                                    <div className="relative bg-slate-100 rounded-full p-2 shadow-sm border border-slate-200">
                                        <Lock className="w-5 h-5 text-slate-400" strokeWidth={2.5} />
                                    </div>
                                </div>
                            )}

                            <div className={`p-4 rounded-2xl ${item.bg}`}>
                                <item.icon className={`w-8 h-8 ${item.color}`} strokeWidth={2} />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-800 tracking-tight">{item.label}</h2>
                                <p className="text-[10px] text-slate-500 mt-1">{item.desc}</p>
                            </div>
                        </Link>
                    );
                })}
            </div>

            <div className="mt-8">
                <button
                    onClick={() => supabase.auth.signOut()}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-rose-200 text-rose-600 p-4 rounded-2xl shadow-sm font-bold active:bg-rose-50 transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    Đăng xuất an toàn
                </button>
            </div>

            <div className="mt-8 text-center">
                <p className="text-xs text-slate-400 font-medium tracking-tight">Phiên bản QLCN v1.0.0. Phục vụ 🍓 sầu riêng.</p>
            </div>
        </div>
    );
}
