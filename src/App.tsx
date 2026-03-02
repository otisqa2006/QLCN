import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MobileLayout } from './components/layout/MobileLayout';
import { Dashboard } from './pages/Dashboard';
import { Capital } from './pages/Capital';
import { Expenses } from './pages/Expenses';
import { Debts } from './pages/Debts';
import { Harvest } from './pages/Harvest';
import { Inventory } from './pages/Inventory';
import { Labor } from './pages/Labor';
import { FarmDiary } from './pages/FarmDiary';
import { Utilities } from './pages/Utilities';
import { ExpenseCategories } from './pages/ExpenseCategories';
import { ExpenseList } from './pages/ExpenseList';
import { AIChat } from './pages/AIChat';
import { Contributors } from './pages/Contributors';
import { Farms } from './pages/Farms';
import { Seasons } from './pages/Seasons';
import { Withdraw } from './pages/Withdraw';
import { Login } from './pages/Login';
import { AdminUsers } from './pages/AdminUsers';
import { ExpenseLogs } from './pages/ExpenseLogs';
import { FarmSelect } from './pages/FarmSelect';
import { FarmMembers } from './pages/FarmMembers';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FarmProvider, useFarmContext } from './contexts/FarmContext';
import { PermissionGuard } from './components/PermissionGuard';
import { Loader2 } from 'lucide-react';

// Protected Route: must be logged in
function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}

// Farm+Season Guard: must have both selected before accessing data pages
// Some management pages are exempt (farms, seasons, utilities, admin, farm-members)
const FARM_EXEMPT_PATHS = ['/farms', '/seasons', '/utilities', '/admin', '/farm-members', '/ai-chat'];

function FarmGuard({ children }: { children: React.ReactNode }) {
    const { currentFarm, currentSeason, loadingFarms } = useFarmContext();
    const location = useLocation();

    if (loadingFarms) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    const isExempt = FARM_EXEMPT_PATHS.some(p => location.pathname.startsWith(p));
    if (!isExempt && (!currentFarm || !currentSeason)) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}

function App() {
    return (
        <AuthProvider>
            <FarmProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />

                        {/* Farm & Season selection (standalone, no bottom nav) */}
                        <Route path="/farm-select" element={
                            <ProtectedRoute>
                                <FarmSelect />
                            </ProtectedRoute>
                        } />

                        {/* Main app routes with bottom navigation */}
                        <Route element={
                            <ProtectedRoute>
                                <FarmGuard>
                                    <MobileLayout />
                                </FarmGuard>
                            </ProtectedRoute>
                        }>
                            <Route path="/" element={
                                <PermissionGuard feature="dashboard"><Dashboard /></PermissionGuard>
                            } />
                            <Route path="/expense-list" element={
                                <PermissionGuard feature="expenses"><ExpenseList /></PermissionGuard>
                            } />
                            <Route path="/expenses" element={
                                <PermissionGuard feature="expenses"><Expenses /></PermissionGuard>
                            } />
                            <Route path="/capital" element={
                                <PermissionGuard feature="capital"><Capital /></PermissionGuard>
                            } />
                            <Route path="/debts" element={
                                <PermissionGuard feature="debts"><Debts /></PermissionGuard>
                            } />
                            <Route path="/inventory" element={
                                <PermissionGuard feature="inventory"><Inventory /></PermissionGuard>
                            } />
                            <Route path="/labor" element={
                                <PermissionGuard feature="labor"><Labor /></PermissionGuard>
                            } />
                            <Route path="/harvest" element={
                                <PermissionGuard feature="harvest"><Harvest /></PermissionGuard>
                            } />
                            <Route path="/diary" element={
                                <PermissionGuard feature="diary"><FarmDiary /></PermissionGuard>
                            } />
                            <Route path="/expense-categories" element={
                                <PermissionGuard feature="expense_categories"><ExpenseCategories /></PermissionGuard>
                            } />
                            <Route path="/withdraw" element={
                                <PermissionGuard feature="withdraw"><Withdraw /></PermissionGuard>
                            } />
                            <Route path="/ai-chat" element={<AIChat />} />
                            <Route path="/contributors" element={<Contributors />} />
                            <Route path="/farms" element={<Farms />} />
                            <Route path="/seasons" element={<Seasons />} />
                            <Route path="/utilities" element={<Utilities />} />
                            <Route path="/farm-members" element={<FarmMembers />} />
                            <Route path="/admin" element={<AdminUsers />} />
                            <Route path="/expense-logs" element={<ExpenseLogs />} />
                        </Route>
                    </Routes>
                </BrowserRouter>
            </FarmProvider>
        </AuthProvider>
    );
}

export default App;
