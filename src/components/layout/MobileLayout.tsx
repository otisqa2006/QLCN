import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Receipt, Grid, Sprout, MapPin, Bot, Lock } from 'lucide-react';
import { useFarmContext } from '../../contexts/FarmContext';
import type { FarmPermissions } from '../../contexts/FarmContext';
import { cn } from '../../lib/utils';

export function MobileLayout() {
    const { currentFarm, currentSeason, currentFarmRole, currentFarmPermissions } = useFarmContext();
    const navigate = useNavigate();

    const isPrivileged = currentFarmRole === 'OWNER' || currentFarmRole === 'ADMIN';

    const allNavItems: { to: string; icon: any; label: string; permission?: keyof FarmPermissions }[] = [
        { to: '/', icon: Home, label: 'Tổng quan', permission: 'dashboard' },
        { to: '/expense-list', icon: Receipt, label: 'Chi tiêu', permission: 'expenses' },
        { to: '/ai-chat', icon: Bot, label: 'AI Chat', permission: 'expenses' },
        { to: '/diary', icon: Sprout, label: 'Nông Vụ', permission: 'diary' },
        { to: '/utilities', icon: Grid, label: 'Tiện ích' },
    ];

    return (
        <div className="flex flex-col h-screen bg-slate-50 text-slate-900 pb-[calc(env(safe-area-inset-bottom)+4rem)]">
            {/* Active Context Header */}
            {currentFarm && currentSeason && (
                <header className="bg-emerald-700 text-emerald-50 px-4 py-2 flex items-center justify-between text-xs font-semibold shadow-md z-40 relative sticky top-0">
                    <div className="flex items-center gap-1.5 w-full max-w-lg mx-auto">
                        <MapPin className="w-3.5 h-3.5 text-emerald-300" />
                        <span className="truncate flex-1">{currentFarm.name} &bull; {currentSeason.name} ({currentSeason.year})</span>
                    </div>
                </header>
            )}

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto w-full max-w-lg mx-auto bg-white shadow-xl relative">
                <Outlet />
            </main>

            {/* Bottom Navigation Bar */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe z-50">
                <div className="max-w-lg mx-auto flex justify-around items-center h-16 px-2">
                    {allNavItems.map((item) => {
                        const hasAccess = !item.permission || isPrivileged || currentFarmPermissions[item.permission];

                        if (!hasAccess) {
                            // Locked: grayed out, not navigable, shows lock badge
                            return (
                                <button
                                    key={item.to}
                                    onClick={() => navigate(item.to)} // PermissionGuard will handle blocking
                                    className="flex flex-col items-center justify-center w-full h-full space-y-1 rounded-xl transition-all opacity-35 relative"
                                >
                                    <div className="relative">
                                        <item.icon className="w-6 h-6 text-slate-400" strokeWidth={2.5} />
                                        <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-slate-400 rounded-full flex items-center justify-center">
                                            <Lock className="w-2 h-2 text-white" strokeWidth={3} />
                                        </span>
                                    </div>
                                    <span className="text-[10px] uppercase tracking-wider text-slate-400">{item.label}</span>
                                </button>
                            );
                        }

                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) =>
                                    cn(
                                        'flex flex-col items-center justify-center w-full h-full space-y-1 rounded-xl transition-all',
                                        isActive
                                            ? 'text-emerald-600 font-semibold'
                                            : 'text-slate-400 font-medium hover:text-emerald-500 hover:bg-emerald-50/50'
                                    )
                                }
                            >
                                <item.icon className="w-6 h-6" strokeWidth={2.5} />
                                <span className="text-[10px] uppercase tracking-wider">{item.label}</span>
                            </NavLink>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
