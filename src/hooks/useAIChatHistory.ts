import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ParsedExpense } from '../lib/gemini';

export interface ChatMessage {
    id: string;
    role: 'user' | 'bot';
    content: string;
    isTyping?: boolean;
    expenses?: ParsedExpense[];
    status?: 'success' | 'error';
    created_at?: string;
}

interface UseAIChatHistoryOptions {
    farmId: string | null;
    seasonId: string | null;
}

export function useAIChatHistory({ farmId, seasonId }: UseAIChatHistoryOptions) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    // Initial greeting message (not saved to DB)
    const getGreetingMessage = (): ChatMessage => ({
        id: 'greeting',
        role: 'bot',
        content: 'Chào bạn! 👋 Mình là trợ lý AI. Mình có thể giúp bạn ghi chép chi tiêu nhanh chóng.\\n\\nVí dụ, bạn có thể chat:\\n\"27/2 Mua xăng : 100k, đồ ăn : 200k\"'
    });

    // Load initial messages — scoped to current farm + season
    const loadInitialMessages = useCallback(async () => {
        if (!user || !farmId || !seasonId) {
            setMessages([getGreetingMessage()]);
            setHasMore(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('ai_chat_history')
                .select('*')
                .eq('user_id', user.id)
                .eq('farm_id', farmId)
                .eq('season_id', seasonId)
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) throw error;

            if (data && data.length > 0) {
                // Supabase returns newest first (index 0 is newest). 
                // We want to render chronological (oldest to newest), so reverse it.
                const formattedHistory: ChatMessage[] = data.map(row => ({
                    id: row.id,
                    role: row.role,
                    content: row.content,
                    expenses: row.expenses_json as ParsedExpense[] | undefined,
                    status: (row.role === 'bot' && !row.content.startsWith('Lỗi:')) ? 'success' : undefined as 'success' | 'error' | undefined,
                    created_at: row.created_at
                })).reverse();

                setMessages([getGreetingMessage(), ...formattedHistory]);
                setHasMore(data.length === 5);
            } else {
                setMessages([getGreetingMessage()]);
                setHasMore(false);
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
            setMessages([getGreetingMessage()]);
        }
    }, [user, farmId, seasonId]);

    // Load older messages for pagination — scoped to current farm + season
    const loadOlderMessages = useCallback(async () => {
        if (!user || !farmId || !seasonId || isLoadingOlder || !hasMore || messages.length <= 1) return;

        const oldestDbMessage = messages.find(m => m.id !== 'greeting');
        if (!oldestDbMessage || !oldestDbMessage.created_at) return;

        setIsLoadingOlder(true);
        try {
            const { data, error } = await supabase
                .from('ai_chat_history')
                .select('*')
                .eq('user_id', user.id)
                .eq('farm_id', farmId)
                .eq('season_id', seasonId)
                .lt('created_at', oldestDbMessage.created_at)
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) throw error;

            if (data && data.length > 0) {
                const formattedHistory: ChatMessage[] = data.map(row => ({
                    id: row.id,
                    role: row.role,
                    content: row.content,
                    expenses: row.expenses_json as ParsedExpense[] | undefined,
                    status: (row.role === 'bot' && !row.content.startsWith('Lỗi:')) ? 'success' : undefined as 'success' | 'error' | undefined,
                    created_at: row.created_at
                })).reverse();

                setMessages(prev => [prev[0], ...formattedHistory, ...prev.slice(1)]);
                setHasMore(data.length === 5);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error('Error loading older messages:', error);
        } finally {
            setIsLoadingOlder(false);
        }
    }, [user, farmId, seasonId, messages, isLoadingOlder, hasMore]);


    // Save a new message — always include farm_id + season_id
    const saveMessage = async (msg: Omit<ChatMessage, 'id' | 'created_at' | 'status'>) => {
        if (!user) return null;

        try {
            const { data, error } = await supabase
                .from('ai_chat_history')
                .insert([{
                    user_id: user.id,
                    farm_id: farmId,
                    season_id: seasonId,
                    role: msg.role,
                    content: msg.content,
                    expenses_json: msg.expenses || null
                }])
                .select()
                .single();

            if (error) {
                console.error("Supabase insert error:", error);
                throw error;
            }
            return data;
        } catch (err) {
            console.error('Failed to save message to DB:', err);
            return null;
        }
    };

    return {
        messages,
        setMessages,
        loadInitialMessages,
        loadOlderMessages,
        saveMessage,
        hasMore,
        isLoadingOlder
    };
}
