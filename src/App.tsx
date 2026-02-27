import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

function App() {
    const [session, setSession] = useState<any>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
                <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
                    QLCN App
                </h1>
                {session ? (
                    <div className="text-center">
                        <p className="text-green-600 font-medium mb-4">Logged in successfully!</p>
                        <button
                            onClick={() => supabase.auth.signOut()}
                            className="w-full bg-red-500 text-white rounded-lg py-2 hover:bg-red-600 transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                ) : (
                    <div className="text-center">
                        <p className="text-gray-600 mb-4">You are not logged in.</p>
                        <button
                            onClick={() => supabase.auth.signInWithOAuth({ provider: 'github' })}
                            className="w-full bg-blue-500 text-white rounded-lg py-2 hover:bg-blue-600 transition-colors"
                        >
                            Sign in with GitHub
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
