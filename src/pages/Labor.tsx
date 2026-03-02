import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, CalendarCheck, UserPlus, CreditCard, Banknote, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, formatCurrency } from '../lib/utils';

type WorkerType = 'DAILY' | 'YEARLY';
type TimesheetStatus = 'NGHI' | 'NUA_NGAY' | 'CA_NGAY';

interface Worker {
    id: string;
    name: string;
    phone: string;
    worker_type: WorkerType;
    daily_wage: number;
    yearly_salary: number;
}

interface Timesheet {
    id: string;
    worker_id: string;
    date: string;
    status: TimesheetStatus;
}

interface Wallet {
    id: string;
    type: 'BANK' | 'CASH';
}

interface Payment {
    id: string;
    worker_id: string;
    amount: number;
    is_advance: boolean;
}

export function Labor() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'CHAM_CONG' | 'DANH_SACH'>('CHAM_CONG');
    const [loading, setLoading] = useState(true);

    const [workers, setWorkers] = useState<Worker[]>([]);
    const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [wallets, setWallets] = useState<Wallet[]>([]);

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
    const [payType, setPayType] = useState<'ADVANCE' | 'PAYMENT'>('PAYMENT');
    const [payAmount, setPayAmount] = useState('');
    const [payWalletType, setPayWalletType] = useState<'BANK' | 'CASH'>('BANK');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // New Worker Modal State
    const [showWorkerModal, setShowWorkerModal] = useState(false);
    const [wName, setWName] = useState('');
    const [wPhone, setWPhone] = useState('');
    const [wType, setWType] = useState<WorkerType>('DAILY');
    const [wWage, setWWage] = useState('');

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [workersRes, timesheetsRes, paymentsRes, walletsRes] = await Promise.all([
                supabase.from('workers').select('*').eq('user_id', user.id).order('name'),
                supabase.from('timesheets').select('*').eq('user_id', user.id),
                supabase.from('salary_advances_payments').select('id, worker_id, amount, is_advance').eq('user_id', user.id),
                supabase.from('wallets').select('id, type').eq('user_id', user.id)
            ]);

            setWorkers(workersRes.data || []);
            setTimesheets(timesheetsRes.data || []);
            setPayments(paymentsRes.data || []);
            setWallets(walletsRes.data || []);
        } catch (error) {
            console.error('Error fetching labor data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user, selectedDate]);

    // Handle Timesheet Toggle
    const handleTimesheetChange = async (workerId: string, status: TimesheetStatus) => {
        if (!user) return;

        // Optimistic update
        const existingTs = timesheets.find(ts => ts.worker_id === workerId && ts.date === selectedDate);
        let newTimesheets = [...timesheets];

        if (existingTs) {
            newTimesheets = newTimesheets.map(ts => ts.id === existingTs.id ? { ...ts, status } : ts);
        } else {
            newTimesheets.push({ id: 'temp', worker_id: workerId, date: selectedDate, status });
        }
        setTimesheets(newTimesheets);

        try {
            if (existingTs) {
                await supabase.from('timesheets').update({ status }).eq('id', existingTs.id);
            } else {
                await supabase.from('timesheets').insert({
                    user_id: user.id,
                    worker_id: workerId,
                    date: selectedDate,
                    status
                });
            }
            fetchData(); // Sync exact IDs
        } catch (error) {
            console.error('Lỗi chấm công:', error);
            alert('Có lỗi xảy ra khi chấm công!');
            fetchData(); // Rollback
        }
    };

    const handleCreateWorker = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('workers').insert({
                user_id: user.id,
                name: wName,
                phone: wPhone,
                worker_type: wType,
                daily_wage: wType === 'DAILY' ? Number(wWage) : 0,
                yearly_salary: wType === 'YEARLY' ? Number(wWage) : 0,
            });
            if (error) throw error;
            setShowWorkerModal(false);
            setWName(''); setWPhone(''); setWWage('');
            fetchData();
        } catch (error: any) {
            alert('Lỗi: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !selectedWorker) return;
        const amountNum = Number(payAmount);
        if (!amountNum || amountNum <= 0) return alert('Số tiền không hợp lệ');

        const selectedWallet = wallets.find(w => w.type === payWalletType);
        if (!selectedWallet) return alert('Không tìm thấy ví');

        // We need an EXPENSE_FUND for the trigger to work correctly. Fetch it.
        const { data: fundData } = await supabase.from('funds').select('id').eq('user_id', user.id).eq('type', 'EXPENSE_FUND').single();
        if (!fundData) return alert('Không tìm thấy Quỹ Chi Tiêu');

        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('salary_advances_payments').insert({
                user_id: user.id,
                worker_id: selectedWorker.id,
                wallet_id: selectedWallet.id,
                fund_id: fundData.id,
                amount: amountNum,
                is_advance: payType === 'ADVANCE'
            });
            if (error) throw error;
            alert('Giao dịch thành công!');
            setShowPaymentModal(false);
            fetchData();
        } catch (error: any) {
            alert('Lỗi: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const openPaymentModal = (worker: Worker, type: 'ADVANCE' | 'PAYMENT') => {
        setSelectedWorker(worker);
        setPayType(type);
        setPayAmount('');
        setShowPaymentModal(true);
    };

    // Calculations
    const getWorkerStats = (workerId: string, dailyWage: number) => {
        const workerTs = timesheets.filter(ts => ts.worker_id === workerId);
        const fullDays = workerTs.filter(ts => ts.status === 'CA_NGAY').length;
        const halfDays = workerTs.filter(ts => ts.status === 'NUA_NGAY').length;
        const totalEarned = (fullDays + (halfDays * 0.5)) * dailyWage;

        const workerPayments = payments.filter(p => p.worker_id === workerId);
        const totalPaidAndAdvanced = workerPayments.reduce((acc, p) => acc + Number(p.amount), 0);

        return { fullDays, halfDays, totalEarned, totalPaidAndAdvanced };
    };

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4 pt-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    const dailyWorkers = workers.filter(w => w.worker_type === 'DAILY');

    return (
        <div className="p-4 space-y-6 pb-20">
            <header className="mb-6 mt-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-slate-200/50 rounded-full text-slate-600 hover:bg-slate-300/50 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <Users className="w-7 h-7 text-blue-600" />
                            Nhân Công
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Chấm công & Trả lương</p>
                    </div>
                </div>
                {activeTab === 'DANH_SACH' && (
                    <button
                        onClick={() => setShowWorkerModal(true)}
                        className="bg-blue-100 text-blue-700 hover:bg-blue-200 p-2.5 rounded-xl transition-colors"
                    >
                        <UserPlus className="w-5 h-5" />
                    </button>
                )}
            </header>

            {/* Category Tabs */}
            <div className="flex p-1 bg-slate-100/80 rounded-2xl space-x-1 border border-slate-200/50">
                <button
                    onClick={() => setActiveTab('CHAM_CONG')}
                    className={cn(
                        'flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all',
                        activeTab === 'CHAM_CONG' ? 'bg-white shadow-sm text-blue-700 ring-1 ring-slate-200' : 'text-slate-500'
                    )}
                >
                    Chấm Công
                </button>
                <button
                    onClick={() => setActiveTab('DANH_SACH')}
                    className={cn(
                        'flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all',
                        activeTab === 'DANH_SACH' ? 'bg-white shadow-sm text-blue-700 ring-1 ring-slate-200' : 'text-slate-500'
                    )}
                >
                    Danh Sách Thợ
                </button>
            </div>

            {activeTab === 'CHAM_CONG' ? (
                <div className="space-y-4">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                        <CalendarCheck className="w-6 h-6 text-slate-400" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="flex-1 font-bold text-slate-700 outline-none bg-transparent"
                        />
                    </div>

                    {dailyWorkers.length === 0 ? (
                        <p className="text-center text-slate-500 py-10">Chưa có thợ công nhật nào.</p>
                    ) : (
                        <div className="space-y-3">
                            {dailyWorkers.map(worker => {
                                const ts = timesheets.find(t => t.worker_id === worker.id && t.date === selectedDate);
                                const status = ts?.status || 'NGHI';
                                return (
                                    <div key={worker.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                        <div className="font-bold text-slate-800 mb-3">{worker.name}</div>
                                        <div className="flex bg-slate-100 p-1 rounded-xl">
                                            {[
                                                { val: 'NGHI', label: 'Nghỉ', color: 'text-slate-500', bg: 'bg-white text-slate-900 shadow' },
                                                { val: 'NUA_NGAY', label: 'Nửa Ngày', color: 'text-amber-500', bg: 'bg-white text-amber-700 shadow' },
                                                { val: 'CA_NGAY', label: 'Cả Ngày', color: 'text-emerald-500', bg: 'bg-white text-emerald-700 shadow' },
                                            ].map(opt => (
                                                <button
                                                    key={opt.val}
                                                    onClick={() => handleTimesheetChange(worker.id, opt.val as TimesheetStatus)}
                                                    className={cn(
                                                        "flex-1 py-2 font-semibold text-sm rounded-lg transition-all",
                                                        status === opt.val ? opt.bg : "text-slate-400"
                                                    )}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {workers.map(worker => {
                        const { fullDays, halfDays, totalEarned, totalPaidAndAdvanced } = getWorkerStats(worker.id, worker.daily_wage);
                        const owed = worker.worker_type === 'DAILY' ? totalEarned - totalPaidAndAdvanced : worker.yearly_salary - totalPaidAndAdvanced;

                        return (
                            <div key={worker.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800">{worker.name}</h3>
                                        <p className="text-sm border inline-block px-2 py-0.5 rounded text-blue-600 border-blue-200 bg-blue-50 font-medium">
                                            {worker.worker_type === 'DAILY' ? 'Công Nhật' : 'Công Năm'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500">Đã ứng / Trả</p>
                                        <p className="font-bold text-slate-700">{formatCurrency(totalPaidAndAdvanced)}</p>
                                    </div>
                                </div>

                                {worker.worker_type === 'DAILY' ? (
                                    <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-3 rounded-xl">
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase">Cả ngày</p>
                                            <p className="font-bold text-emerald-600">{fullDays}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase">Nửa ngày</p>
                                            <p className="font-bold text-amber-600">{halfDays}</p>
                                        </div>
                                        <div className="border-l border-slate-200">
                                            <p className="text-[10px] text-slate-500 uppercase">Còn Nợ</p>
                                            <p className={cn("font-bold", owed > 0 ? "text-rose-600" : "text-slate-700")}>
                                                {formatCurrency(owed)}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase">Lương Năm</p>
                                            <p className="font-bold text-slate-700">{formatCurrency(worker.yearly_salary)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-500 uppercase">Còn Nợ</p>
                                            <p className={cn("font-bold", owed > 0 ? "text-rose-600" : "text-slate-700")}>
                                                {formatCurrency(owed)}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => openPaymentModal(worker, 'ADVANCE')}
                                        className="flex-1 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold rounded-xl transition text-sm text-center"
                                    >
                                        Cho Ứng
                                    </button>
                                    <button
                                        onClick={() => openPaymentModal(worker, 'PAYMENT')}
                                        className="flex-1 py-2.5 bg-blue-600 text-white hover:bg-blue-700 font-bold rounded-xl shadow-lg shadow-blue-500/30 transition text-sm text-center"
                                    >
                                        Trả Lương
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && selectedWorker && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800">
                                {payType === 'ADVANCE' ? 'Ứng lương cho ' : 'Trả lương cho '} {selectedWorker.name}
                            </h2>
                            <button onClick={() => setShowPaymentModal(false)} className="w-8 h-8 bg-slate-100 rounded-full">✕</button>
                        </div>
                        <form onSubmit={handlePayment} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="block text-sm font-semibold text-slate-700">Số tiền (VNĐ)</label>
                                <input
                                    type="number"
                                    required
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 text-xl font-bold rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-sm font-semibold text-slate-700">Truy xuất từ Ví/Két</label>
                                <div className="flex p-1 bg-slate-100 rounded-xl space-x-1">
                                    <button
                                        type="button"
                                        onClick={() => setPayWalletType('BANK')}
                                        className={cn('flex-1 py-3 text-sm font-bold rounded-lg flex items-center justify-center gap-1', payWalletType === 'BANK' ? 'bg-white shadow text-blue-600' : 'text-slate-500')}
                                    >
                                        <CreditCard className="w-4 h-4" /> Bank
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPayWalletType('CASH')}
                                        className={cn('flex-1 py-3 text-sm font-bold rounded-lg flex items-center justify-center gap-1', payWalletType === 'CASH' ? 'bg-white shadow text-amber-600' : 'text-slate-500')}
                                    >
                                        <Banknote className="w-4 h-4" /> Tiền mặt
                                    </button>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full flex justify-center gap-2 bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg mt-4"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : 'Xác Nhận'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* New Worker Modal */}
            {showWorkerModal && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800">Thêm Nhân Công Mới</h2>
                            <button onClick={() => setShowWorkerModal(false)} className="w-8 h-8 bg-slate-100 rounded-full">✕</button>
                        </div>
                        <form onSubmit={handleCreateWorker} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Tên thợ</label>
                                <input type="text" required value={wName} onChange={e => setWName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Loại công</label>
                                <select value={wType} onChange={e => setWType(e.target.value as WorkerType)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none">
                                    <option value="DAILY">Công Nhật</option>
                                    <option value="YEARLY">Công Năm</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">
                                    {wType === 'DAILY' ? 'Lương 1 Ngày (VNĐ)' : 'Lương Cả Năm (VNĐ)'}
                                </label>
                                <input type="number" required value={wWage} onChange={e => setWWage(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none" />
                            </div>
                            <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg">Lưu Nhân Công</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
