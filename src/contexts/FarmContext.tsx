import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface Farm {
    id: string;
    name: string;
    location?: string;
    area?: number;
    user_id?: string;
}

export interface Season {
    id: string;
    farm_id: string;
    name: string;
    year: number;
    status: string;
}

export type FarmRole = 'ADMIN' | 'OWNER' | 'MANAGER' | 'WORKER' | 'NONE';

export interface FarmPermissions {
    dashboard: boolean;
    expenses: boolean;
    harvest: boolean;
    capital: boolean;
    debts: boolean;
    inventory: boolean;
    labor: boolean;
    diary: boolean;
    expense_categories: boolean;
    withdraw: boolean;
}

const ALL_PERMISSIONS: FarmPermissions = {
    dashboard: true, expenses: true, harvest: true, capital: true,
    debts: true, inventory: true, labor: true, diary: true,
    expense_categories: true, withdraw: true,
};

const NO_PERMISSIONS: FarmPermissions = {
    dashboard: false, expenses: false, harvest: false, capital: false,
    debts: false, inventory: false, labor: false, diary: false,
    expense_categories: false, withdraw: false,
};

interface FarmContextType {
    currentFarm: Farm | null;
    currentSeason: Season | null;
    currentFarmRole: FarmRole;
    currentFarmPermissions: FarmPermissions;
    farms: Farm[];
    seasons: Season[];
    loadingFarms: boolean;
    setCurrentFarm: (farm: Farm | null) => void;
    setCurrentSeason: (season: Season | null) => void;
    refreshData: (overrideFarmId?: string, overrideSeasonId?: string) => Promise<void>;
}

const FarmContext = createContext<FarmContextType | undefined>(undefined);

export function FarmProvider({ children }: { children: ReactNode }) {
    const { user, isAdmin } = useAuth();
    const [farms, setFarms] = useState<Farm[]>([]);
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [currentFarm, setCurrentFarm] = useState<Farm | null>(null);
    const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
    const [currentFarmRole, setCurrentFarmRole] = useState<FarmRole>('NONE');
    const [currentFarmPermissions, setCurrentFarmPermissions] = useState<FarmPermissions>(NO_PERMISSIONS);
    const [loadingFarms, setLoadingFarms] = useState(true);

    // Use refs to always have the latest value inside async callbacks
    const currentFarmRef = useRef<Farm | null>(null);
    const currentSeasonRef = useRef<Season | null>(null);
    useEffect(() => { currentFarmRef.current = currentFarm; }, [currentFarm]);
    useEffect(() => { currentSeasonRef.current = currentSeason; }, [currentSeason]);

    const refreshData = async (overrideFarmId?: string, overrideSeasonId?: string) => {
        if (!user) {
            setFarms([]);
            setSeasons([]);
            setCurrentFarm(null);
            setCurrentSeason(null);
            setCurrentFarmRole('NONE');
            setCurrentFarmPermissions(NO_PERMISSIONS);
            setLoadingFarms(false);
            return;
        }

        setLoadingFarms(true);
        try {
            // Fetch Farms the user is a member of (RLS handles this now)
            const { data: farmsData, error: farmsError } = await supabase
                .from('farms')
                .select('*')
                .order('created_at', { ascending: true });

            if (farmsError) throw farmsError;
            setFarms(farmsData || []);

            // Prefer override (newly created) > in-memory ref > localStorage
            const savedFarmId = overrideFarmId || currentFarmRef.current?.id || localStorage.getItem('qlcn_current_farm_id');
            const activeFarm = farmsData?.find(f => f.id === savedFarmId) || farmsData?.[0] || null;
            setCurrentFarm(activeFarm);
            if (activeFarm) localStorage.setItem('qlcn_current_farm_id', activeFarm.id);

            // Fetch Seasons for the active Farm
            if (activeFarm) {
                const { data: seasonsData, error: seasonsError } = await supabase
                    .from('harvest_seasons')
                    .select('*')
                    .eq('farm_id', activeFarm.id)
                    .order('year', { ascending: false });

                if (seasonsError) throw seasonsError;
                setSeasons(seasonsData || []);

                // Prefer override (newly created) > in-memory ref > localStorage
                const savedSeasonId = overrideSeasonId || currentSeasonRef.current?.id || localStorage.getItem('qlcn_current_season_id');
                const activeSeason = seasonsData?.find(s => s.id === savedSeasonId) || seasonsData?.[0] || null;
                setCurrentSeason(activeSeason);
                if (activeSeason) localStorage.setItem('qlcn_current_season_id', activeSeason.id);
            } else {
                setSeasons([]);
                setCurrentSeason(null);
            }

        } catch (error) {
            console.error('Error fetching farm context data:', error);
        } finally {
            setLoadingFarms(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, [user]);

    // Handle Farm Change => Refresh Seasons
    useEffect(() => {
        if (!currentFarm) return;

        const fetchSeasonsForFarm = async () => {
            const { data, error } = await supabase
                .from('harvest_seasons')
                .select('*')
                .eq('farm_id', currentFarm.id)
                .order('year', { ascending: false });

            if (!error && data) {
                setSeasons(data);
                const seasonExists = data.find(s => s.id === currentSeason?.id);
                if (!seasonExists) {
                    const newSeason = data[0] || null;
                    handleSetSeason(newSeason);
                }
            }
        };

        handleSetFarm(currentFarm, false); // Save to storage, don't trigger re-fetch loops
        fetchSeasonsForFarm();
    }, [currentFarm?.id]);

    // Fetch role + permissions when farm changes
    useEffect(() => {
        if (!currentFarm) {
            setCurrentFarmRole('NONE');
            setCurrentFarmPermissions(NO_PERMISSIONS);
            return;
        }

        if (isAdmin) {
            setCurrentFarmRole('ADMIN');
            setCurrentFarmPermissions(ALL_PERMISSIONS);
            return;
        }

        const fetchRoleAndPermissions = async () => {
            try {
                const [roleResult, permResult] = await Promise.all([
                    supabase.rpc('get_my_farm_role', { p_farm_id: currentFarm.id }),
                    supabase.rpc('get_my_farm_permissions', { p_farm_id: currentFarm.id }),
                ]);

                const role = (roleResult.data as FarmRole) || 'NONE';
                setCurrentFarmRole(role);

                if (role === 'OWNER') {
                    setCurrentFarmPermissions(ALL_PERMISSIONS);
                } else if (permResult.data) {
                    setCurrentFarmPermissions({ ...NO_PERMISSIONS, ...permResult.data });
                } else {
                    setCurrentFarmPermissions(NO_PERMISSIONS);
                }
            } catch (err) {
                console.error('Failed to fetch farm role/permissions', err);
                setCurrentFarmRole('NONE');
                setCurrentFarmPermissions(NO_PERMISSIONS);
            }
        };

        fetchRoleAndPermissions();
    }, [currentFarm?.id, isAdmin]);

    const handleSetFarm = (farm: Farm | null, persist = true) => {
        if (persist) setCurrentFarm(farm);
        if (farm) localStorage.setItem('qlcn_current_farm_id', farm.id);
        else localStorage.removeItem('qlcn_current_farm_id');
    };

    const handleSetSeason = (season: Season | null) => {
        setCurrentSeason(season);
        if (season) localStorage.setItem('qlcn_current_season_id', season.id);
        else localStorage.removeItem('qlcn_current_season_id');
    };

    return (
        <FarmContext.Provider value={{
            currentFarm,
            currentSeason,
            currentFarmRole,
            currentFarmPermissions,
            farms,
            seasons,
            loadingFarms,
            setCurrentFarm: handleSetFarm,
            setCurrentSeason: handleSetSeason,
            refreshData
        }}>
            {children}
        </FarmContext.Provider>
    );
}

export function useFarmContext() {
    const context = useContext(FarmContext);
    if (context === undefined) {
        throw new Error('useFarmContext must be used within a FarmProvider');
    }
    return context;
}
