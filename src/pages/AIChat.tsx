import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFarmContext } from '../contexts/FarmContext';
import { parseExpensesFromText } from '../lib/gemini';
import { Send, Loader2, Bot, CheckCircle2, ChevronLeft, X, Edit2, Droplet, Bug, Scissors, Users, Utensils, Fuel, MoreHorizontal, Zap, ShoppingCart, Wrench, Trash2 } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAIChatHistory, ChatMessage } from '../hooks/useAIChatHistory';

const iconMap: Record<string, any> = { Droplet, Bug, Scissors, Users, Utensils, Fuel, MoreHorizontal, Zap, ShoppingCart, Wrench };
const getLocalCategoryIcon = (iconName?: string) => {
    if (iconName && iconMap[iconName]) return iconMap[iconName];
    return MoreHorizontal;
};

export function AIChat() {
    const { user } = useAuth();
    const { currentFarm, currentSeason } = useFarmContext();
    const navigate = useNavigate();

    const {
        messages,
        setMessages,
        loadInitialMessages,
        loadOlderMessages,
        saveMessage,
        hasMore,
        isLoadingOlder
    } = useAIChatHistory({
        farmId: currentFarm?.id ?? null,
        seasonId: currentSeason?.id ?? null,
    });

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const observerTargetRef = useRef<HTMLDivElement>(null);
    const previousScrollHeightRef = useRef<number>(0);

    // Edit Modal State
    const [editingExpense, setEditingExpense] = useState<any>(null);
    const [editAmount, setEditAmount] = useState<string>('');
    const [editDate, setEditDate] = useState<string>('');
    const [editCategoryId, setEditCategoryId] = useState<string>('');
    const [editWalletId, setEditWalletId] = useState<string>('');
    const [editNotes, setEditNotes] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    // Reload chat history whenever farm or season changes
    useEffect(() => {
        loadInitialMessages();
    }, [loadInitialMessages]);

    // Context Data
    const [categories, setCategories] = useState<any[]>([]);
    const [wallets, setWallets] = useState<any[]>([]);
    const [expenseFund, setExpenseFund] = useState<any>(null);

    // Fetch necessary data for inserting expenses
    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            try {
                const { data: cats } = await supabase.from('expense_categories').select('*').eq('user_id', user.id);
                setCategories(cats || []);

                const { data: wals } = await supabase.from('wallets').select('*').eq('user_id', user.id);
                setWallets(wals || []);

                const { data: fund } = await supabase.from('funds').select('id').eq('user_id', user.id).eq('type', 'EXPENSE_FUND').single();
                setExpenseFund(fund);

            } catch (error) {
                console.error('Error fetching context data for AI Chat:', error);
            }
        };

        fetchData();
    }, [user]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Auto scroll down only when sending a new message (not when loading old ones)
    useEffect(() => {
        if (!isLoadingOlder && messages.length <= 6) {
            // Only auto-scroll to bottom on initial load or if there are very few messages
            scrollToBottom();
        } else if (!isLoadingOlder && messages.length > 6 && chatContainerRef.current) {
            // Check if user is near bottom, if so, keep scrolling down
            const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
            if (isNearBottom) {
                scrollToBottom();
            }
        }
    }, [messages.length, isLoadingOlder]);

    // Infinite Scroll Intersection Observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !isLoadingOlder) {
                    // Record scroll height before data loads
                    if (chatContainerRef.current) {
                        previousScrollHeightRef.current = chatContainerRef.current.scrollHeight;
                    }
                    loadOlderMessages();
                }
            },
            { threshold: 1.0 }
        );

        if (observerTargetRef.current) {
            observer.observe(observerTargetRef.current);
        }

        return () => {
            if (observerTargetRef.current) observer.unobserve(observerTargetRef.current);
        };
    }, [hasMore, isLoadingOlder, loadOlderMessages]);

    // Restore scroll position after older messages load
    useEffect(() => {
        if (!isLoadingOlder && previousScrollHeightRef.current > 0 && chatContainerRef.current) {
            const newScrollHeight = chatContainerRef.current.scrollHeight;
            const heightDifference = newScrollHeight - previousScrollHeightRef.current;

            // Adjust scroll position so the user stays exactly where they were looking
            chatContainerRef.current.scrollTop += heightDifference;

            // Reset reference
            previousScrollHeightRef.current = 0;
        }
    }, [messages, isLoadingOlder]);

    const findMatchingCategory = (keyword: string) => {
        if (!categories || categories.length === 0) return null;
        const kw = keyword.toLowerCase().trim();

        // Exact match
        let match = categories.find(c => c.name.toLowerCase() === kw);
        if (match) return match.id;

        // Partial match
        match = categories.find(c => c.name.toLowerCase().includes(kw) || kw.includes(c.name.toLowerCase()));
        if (match) return match.id;

        // Fallback to a default 'Khác' or first category if none matched
        const other = categories.find(c => c.name.toLowerCase().includes('khác'));
        return other ? other.id : categories[0].id;
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userText = input.trim();
        setInput('');

        // Immediate optimistic UI for user message
        const userTempId = Date.now().toString();
        const newUserMsg: ChatMessage = { id: userTempId, role: 'user', content: userText };
        setMessages(prev => [...prev, newUserMsg]);

        // Save user message to DB and update with real ID
        const savedUserMsg = await saveMessage({ role: 'user', content: userText });
        if (savedUserMsg) {
            setMessages(prev => prev.map(m => m.id === userTempId ? { ...m, id: savedUserMsg.id } : m));
        }

        // Add loading bot message
        const typingMsgId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: typingMsgId, role: 'bot', content: '', isTyping: true }]);
        setIsLoading(true);

        try {
            if (!expenseFund) throw new Error('Không tìm thấy Quỹ chi tiêu.');
            if (wallets.length === 0) throw new Error('Bạn chưa có Ví nào để chi tiền.');
            if (!currentFarm || !currentSeason) throw new Error('Vui lòng chọn Khu Vườn và Mùa Vụ.');

            // Call Gemini API
            const parsedExpenses = await parseExpensesFromText(userText);

            if (parsedExpenses.length === 0) {
                const errorMsg = 'Mình không tìm thấy khoản chi tiêu nào trong tin nhắn của bạn. Bạn thử nhập lại cụ thể hơn nhé.';
                setMessages(prev => prev.map(m => m.id === typingMsgId ? {
                    id: typingMsgId, role: 'bot', content: errorMsg, status: 'error'
                } : m));
                const savedErrorMsg = await saveMessage({ role: 'bot', content: errorMsg });
                if (savedErrorMsg) {
                    setMessages(prev => prev.map(m => m.id === typingMsgId ? { ...m, id: savedErrorMsg.id } : m));
                }
                setIsLoading(false);
                return;
            }

            // Prepare inserts mapping keywords to actual category IDs
            const inserts = parsedExpenses.map(exp => {
                const catId = findMatchingCategory(exp.category_keyword);
                const walletId = wallets[0]?.id;

                return {
                    user_id: user?.id,
                    farm_id: currentFarm.id,
                    season_id: currentSeason.id,
                    category_id: catId,
                    wallet_id: walletId,
                    fund_id: expenseFund.id,
                    amount: exp.amount,
                    date: exp.date,
                    description: exp.description
                };
            });

            // Insert to Supabase and select joined data for rich UI
            const { data: insertedExpenses, error: insertError } = await supabase.from('expenses').insert(inserts).select(`
                id, amount, date, description, category_id, wallet_id,
                expense_categories ( id, name, icon_name, color_code ),
                wallets ( id, type )
            `);

            if (insertError) throw insertError;

            // Use the rich data from DB for rendering
            const enrichedExpenses = insertedExpenses || [];

            // Success Response
            let summaryContent = `Đã lưu thành công ${enrichedExpenses.length} khoản chi.`;

            setMessages(prev => prev.map(m => m.id === typingMsgId ? {
                id: typingMsgId,
                role: 'bot',
                content: summaryContent,
                expenses: enrichedExpenses as any,
                status: 'success'
            } : m));

            const savedBotMsg = await saveMessage({ role: 'bot', content: summaryContent, expenses: enrichedExpenses as any });
            if (savedBotMsg) {
                setMessages(prev => prev.map(m => m.id === typingMsgId ? { ...m, id: savedBotMsg.id } : m));
            }

        } catch (error: any) {
            const errorContent = `Lỗi: ${error.message || 'Có lỗi xảy ra'}`;
            setMessages(prev => prev.map(m => m.id === typingMsgId ? {
                id: typingMsgId, role: 'bot', content: errorContent, status: 'error'
            } : m));
            const savedErrorMsg = await saveMessage({ role: 'bot', content: errorContent });
            if (savedErrorMsg) {
                setMessages(prev => prev.map(m => m.id === typingMsgId ? { ...m, id: savedErrorMsg.id } : m));
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Edit Logic
    const openEdit = (exp: any) => {
        setEditingExpense(exp);
        setEditAmount((exp.amount / 1000).toString());
        setEditDate(exp.date);
        setEditCategoryId(exp.category_id);
        setEditWalletId(exp.wallet_id);
        setEditNotes(exp.description || '');
    };

    const handleSaveEdit = async () => {
        if (!editingExpense || !editingExpense.id || editingExpense.id === 'undefined') {
            alert('Không thể lưu: Thẻ này thiếu dữ liệu ID. Vui lòng thử lại với các thẻ mới.');
            return;
        }

        const actualAmount = Number(editAmount.replace(/\D/g, '')) * 1000;
        if (actualAmount <= 0) {
            alert('Số tiền thu/chi phải lớn hơn 0');
            return;
        }
        setIsSaving(true);
        try {
            // Update Supabase Database
            const { data: updatedData, error } = await supabase
                .from('expenses')
                .update({
                    amount: actualAmount,
                    date: editDate,
                    category_id: editCategoryId,
                    wallet_id: editWalletId,
                    description: editNotes.trim() || null
                })
                .eq('id', editingExpense.id)
                .select(`
                    id, amount, date, description, category_id, wallet_id,
                    expense_categories ( id, name, icon_name, color_code ),
                    wallets ( id, type )
                `)
                .single();

            if (error) throw error;

            // We need to update the chat message state containing this expense.
            // Find the message that contains this edited expense.
            let targetMsgId: string | null = null;
            let updatedExpenses: any[] = [];

            messages.forEach(msg => {
                if (msg.expenses && msg.expenses.some(e => (e as any).id === editingExpense.id)) {
                    targetMsgId = msg.id;
                    updatedExpenses = msg.expenses.map(e => (e as any).id === editingExpense.id ? updatedData : e);
                }
            });

            if (targetMsgId) {
                // Update Local UI State
                setMessages(prev => prev.map(m => m.id === targetMsgId ? {
                    ...m,
                    expenses: updatedExpenses
                } : m));

                // Update JSON in ai_chat_history DB invisibly
                // We only need to find the UUID of the chat history row.
                // messages[].id in our hook is actually the row UUID.
                await supabase
                    .from('ai_chat_history')
                    .update({ expenses_json: updatedExpenses })
                    .eq('id', targetMsgId);
            }

            setEditingExpense(null);
        } catch (error: any) {
            alert('Lỗi cập nhật: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleArchiveEdit = async () => {
        if (!editingExpense || !editingExpense.id || editingExpense.id === 'undefined') {
            alert('Không thể xóa: Thẻ này thiếu dữ liệu ID (có thể do lỗi phiên nối trước đó). Tính năng quản lý thẻ cũ sẽ được tối ưu thêm sau.');
            return;
        }

        if (!confirm('Bạn có chắc muốn xóa khoản chi này?')) return;
        setIsSaving(true);
        try {
            const { data: updatedData, error } = await supabase
                .from('expenses')
                .update({ is_archived: true })
                .eq('id', editingExpense.id)
                .select(`
                    id, amount, date, description, category_id, wallet_id, is_archived,
                    expense_categories ( id, name, icon_name, color_code ),
                    wallets ( id, type )
                `)
                .single();

            if (error) throw error;

            let targetMsgId: string | null = null;
            let updatedExpenses: any[] = [];

            messages.forEach(msg => {
                if (msg.expenses && msg.expenses.some(e => (e as any).id === editingExpense.id)) {
                    targetMsgId = msg.id;
                    updatedExpenses = msg.expenses.map(e => (e as any).id === editingExpense.id ? updatedData : e);
                }
            });

            if (targetMsgId) {
                setMessages(prev => prev.map(m => m.id === targetMsgId ? {
                    ...m,
                    expenses: updatedExpenses
                } : m));

                await supabase
                    .from('ai_chat_history')
                    .update({ expenses_json: updatedExpenses })
                    .eq('id', targetMsgId);
            }

            setEditingExpense(null);
        } catch (error: any) {
            alert('Lỗi xóa: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="absolute inset-0 pb-[64px] flex flex-col bg-slate-50 overflow-hidden">
            {/* HEADER */}
            <header className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0 z-10">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="bg-emerald-100 p-1.5 rounded-full text-emerald-600">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-800 leading-tight">Trợ Lý Nhập Liệu</h1>
                            {currentFarm && currentSeason && (
                                <p className="text-[11px] text-slate-400 font-medium leading-tight">
                                    {currentFarm.name} · {currentSeason.name} {currentSeason.year}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </header>


            {/* CHAT AREA */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* Infinite Scroll Observer Target */}
                {hasMore && (
                    <div ref={observerTargetRef} className="flex justify-center h-8">
                        {isLoadingOlder && <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />}
                    </div>
                )}

                {messages.map((msg) => (
                    <div key={msg.id} className={cn("flex w-full", msg.role === 'user' ? "justify-end" : "justify-start")}>
                        <div className={cn(
                            "max-w-[85%] rounded-[1.5rem] p-4 text-sm font-medium shadow-sm relative",
                            msg.role === 'user'
                                ? "bg-emerald-500 text-white rounded-tr-sm"
                                : "bg-white text-slate-700 border border-slate-100 rounded-tl-sm"
                        )}>
                            {msg.role === 'bot' && (
                                <div className="absolute -left-2 -top-2 bg-emerald-100 p-1.5 rounded-full text-emerald-600 border border-white shadow-sm">
                                    <Bot className="w-4 h-4" />
                                </div>
                            )}

                            {msg.isTyping ? (
                                <div className="flex items-center gap-1.5 h-6 ml-4">
                                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            ) : (
                                <div className={cn(msg.role === 'bot' ? "pl-4" : "")}>
                                    {/* Render newlines ONLY IF there are no rich expenses to show */}
                                    {(!msg.expenses || msg.expenses.length === 0) && msg.content.split('\\n').map((line, i) => (
                                        <p key={i} className="mb-1 last:mb-0">
                                            {/* Render simple bold text */}
                                            {line.split(/\\*\\*(.*?)\\*\\*/g).map((part, j) =>
                                                j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                                            )}
                                        </p>
                                    ))}

                                    {/* Render Rich Expense Cards if available */}
                                    {msg.expenses && msg.expenses.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {msg.expenses.map((exp: any, i) => {
                                                // Handle potential array wrapping from Supabase generic typing
                                                const cat = Array.isArray(exp.expense_categories) ? exp.expense_categories[0] : exp.expense_categories;
                                                const wal = Array.isArray(exp.wallets) ? exp.wallets[0] : exp.wallets;

                                                const IconC = getLocalCategoryIcon(cat?.icon_name);
                                                const catColor = cat?.color_code || '#64748b';

                                                const isDeleted = exp.is_archived === true;

                                                return (
                                                    <div
                                                        key={exp.id || i}
                                                        className={cn(
                                                            "bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 active:scale-[0.98] transition-all relative overflow-hidden",
                                                            isDeleted && "opacity-60 grayscale-[0.8] cursor-not-allowed pointer-events-none"
                                                        )}
                                                    >
                                                        {isDeleted && (
                                                            <div className="absolute inset-0 bg-white/40 z-10 flex items-center justify-center">
                                                                <div className="bg-rose-100 text-rose-600 px-3 py-1 rounded-full text-xs font-bold border border-rose-200 flex items-center gap-1 shadow-sm transform -rotate-12">
                                                                    <X className="w-3 h-3" /> Đã Xóa
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${catColor}20`, color: catColor }}>
                                                            <IconC className="w-5 h-5" />
                                                        </div>

                                                        <div className="flex-1 min-w-0" onClick={() => !isDeleted && openEdit(exp)}>
                                                            <h3 className={cn("font-bold text-sm truncate", isDeleted ? "text-slate-500 line-through" : "text-slate-800")}>{cat?.name || exp.description || 'Không rõ'}</h3>
                                                            <div className="flex items-center gap-2 mt-1 -ml-1 flex-wrap">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                                                                    {new Date(exp.date).toLocaleDateString('vi-VN')}
                                                                </span>
                                                                {wal && (
                                                                    <span className={cn(
                                                                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border",
                                                                        wal.type === 'CASH'
                                                                            ? 'bg-amber-50 text-amber-600 border-amber-200'
                                                                            : 'bg-blue-50 text-blue-600 border-blue-200'
                                                                    )}>
                                                                        {wal.type === 'CASH' ? 'Tiền mặt' : 'Bank'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="text-right flex flex-col justify-center items-end" onClick={() => !isDeleted && openEdit(exp)}>
                                                            <p className={cn("font-black text-sm", isDeleted ? "text-slate-400 line-through" : "text-rose-500")}>-{formatCurrency(exp.amount)}</p>
                                                            {!isDeleted && <p className="text-[10px] font-bold uppercase text-slate-400 mt-1 hover:text-emerald-500">Sửa</p>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {msg.status === 'success' && (
                                        <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 font-bold bg-emerald-50 p-2 rounded-xl">
                                            <CheckCircle2 className="w-4 h-4" /> Đã lưu vào CSDL
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* INPUT AREA */}
            <div className="bg-white p-4 border-t border-slate-200">
                <div className="flex items-center gap-2 max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-[1.5rem] p-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-400 transition-all">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Nhập: 27/2 ăn sáng 50k, đổ xăng 50k..."
                        className="flex-1 bg-transparent px-4 py-2 outline-none text-slate-700 text-sm font-medium placeholder:text-slate-400"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="p-2.5 rounded-xl bg-slate-900 text-white disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 transition-colors shadow-md shadow-slate-900/10"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                </div>
                <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">
                    AI có thể phân tích nhiều khoản chi trong 1 tin nhắn.
                </p>
            </div>

            {/* === EDIT MODAL === */}
            {editingExpense && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8">
                        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                            <h2 className="font-bold text-lg text-slate-800">Sửa Khoản Chi</h2>
                            <button onClick={() => setEditingExpense(null)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 hover:text-rose-500 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
                            {/* Amount */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Số tiền (k)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={editAmount}
                                        onChange={e => setEditAmount(e.target.value)}
                                        className="w-full bg-slate-100 text-slate-800 text-lg font-black px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">.000 đ</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {/* Date */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Ngày</label>
                                    <input
                                        type="date"
                                        value={editDate}
                                        onChange={e => setEditDate(e.target.value)}
                                        className="w-full bg-slate-100 text-slate-800 text-sm font-bold px-3 py-3 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    />
                                </div>
                                {/* Wallet */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Nguồn tiền</label>
                                    <select
                                        value={editWalletId}
                                        onChange={e => setEditWalletId(e.target.value)}
                                        className="w-full bg-slate-100 text-slate-800 text-sm font-bold px-3 py-3 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    >
                                        {wallets.map(w => <option key={w.id} value={w.id}>{w.type === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Danh mục</label>
                                <select
                                    value={editCategoryId}
                                    onChange={e => setEditCategoryId(e.target.value)}
                                    className="w-full bg-slate-100 text-slate-800 text-sm font-bold px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50"
                                >
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Ghi chú</label>
                                <textarea
                                    value={editNotes}
                                    onChange={e => setEditNotes(e.target.value)}
                                    rows={2}
                                    className="w-full bg-slate-100 text-slate-800 text-sm font-medium px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                                />
                            </div>

                            <div className="pt-2 flex flex-col gap-2">
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={isSaving}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex justify-center items-center gap-2"
                                >
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Edit2 className="w-5 h-5" /> Lưu Thay Đổi</>}
                                </button>
                                <button
                                    onClick={handleArchiveEdit}
                                    disabled={isSaving}
                                    className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 border border-rose-100"
                                >
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Trash2 className="w-5 h-5" /> Xóa Khoản Chi</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
