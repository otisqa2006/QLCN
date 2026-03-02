import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ensureUserSystemData } from '../lib/autoHeal';

type AuthContextType = {
    user: User | null;
    session: Session | null;
    isAdmin: boolean;
    loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    isAdmin: false,
    loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    const checkAdminStatus = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('is_admin, is_locked')
                .eq('id', userId)
                .single();
            if (!error && data) {
                if (data.is_locked) {
                    // Force sign out immediately
                    await supabase.auth.signOut();
                    alert('Tài khoản của bạn đã bị khoá. Vui lòng liên hệ quản trị viên.');
                    return;
                }
                setIsAdmin(data.is_admin);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        // Check active sessions and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                ensureUserSystemData(session.user.id);
                checkAdminStatus(session.user.id);
            } else {
                setLoading(false);
            }
        });

        // Listen for changes on auth state (login, logout, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                ensureUserSystemData(session.user.id);
                checkAdminStatus(session.user.id);
            } else {
                setLoading(false);
                setIsAdmin(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Stop loading only after isAdmin check finishes, or simply don't block render.
    // We'll unblock it after user sets, but UI might flash. Wait for user profile check logic.
    useEffect(() => {
        if (!user) return;
        setLoading(false);
    }, [user, isAdmin]);

    return (
        <AuthContext.Provider value={{ user, session, isAdmin, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    return useContext(AuthContext);
};
