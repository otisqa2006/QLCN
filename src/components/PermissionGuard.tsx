import { ReactNode } from 'react';
import { useFarmContext, FarmPermissions } from '../contexts/FarmContext';
import { Lock } from 'lucide-react';

interface Props {
    feature: keyof FarmPermissions;
    children: ReactNode;
}

export function PermissionGuard({ feature, children }: Props) {
    const { currentFarmRole, currentFarmPermissions } = useFarmContext();

    // Owners and admins always get full access
    if (currentFarmRole === 'ADMIN' || currentFarmRole === 'OWNER') {
        return <>{children}</>;
    }

    if (currentFarmPermissions[feature]) {
        return <>{children}</>;
    }

    // Locked state — shown when user taps a locked nav item
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
            {/* Lock icon with pulsing ring */}
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-slate-200 rounded-3xl animate-ping opacity-30" />
                <div className="relative w-24 h-24 bg-white rounded-3xl shadow-lg flex items-center justify-center border border-slate-100">
                    <Lock className="w-12 h-12 text-slate-300" strokeWidth={1.5} />
                </div>
            </div>

            <h2 className="text-xl font-black text-slate-800 mb-2 tracking-tight">
                Chưa có quyền truy cập
            </h2>
            <p className="text-sm text-slate-400 font-medium max-w-[240px] leading-relaxed">
                Tính năng này chưa được cấp quyền cho tài khoản của bạn.
            </p>
            <div className="mt-6 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex items-center gap-2 max-w-xs">
                <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-600 font-semibold text-left">
                    Liên hệ chủ vườn để được cấp quyền sử dụng tính năng này.
                </p>
            </div>
        </div>
    );
}
