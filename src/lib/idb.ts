import { openDB, DBSchema } from 'idb';

interface FarmDiaryDB extends DBSchema {
    farm_logs_queue: {
        key: string; // Use a generated unique ID locally
        value: {
            id: string; // Local ID
            user_id: string;
            farm_id?: string | null;
            season_id?: string | null;
            plot_id: string;
            action_type: string;
            worker_id?: string | null;
            notes?: string;
            date: string;
            materials: Array<{
                inventory_item_id: string;
                quantity_used: number;
            }>;
            timestamp: number; // For ordering
        };
    };
}

const DB_NAME = 'QLCN_OfflineDB';
const DB_VERSION = 1;

export async function initDB() {
    return openDB<FarmDiaryDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('farm_logs_queue')) {
                db.createObjectStore('farm_logs_queue', { keyPath: 'id' });
            }
        },
    });
}

export async function saveLogToOfflineQueue(logData: FarmDiaryDB['farm_logs_queue']['value']) {
    const db = await initDB();
    await db.put('farm_logs_queue', logData);
}

export async function getOfflineLogs() {
    const db = await initDB();
    return db.getAll('farm_logs_queue');
}

export async function removeLogFromQueue(id: string) {
    const db = await initDB();
    await db.delete('farm_logs_queue', id);
}

export async function clearOfflineQueue() {
    const db = await initDB();
    await db.clear('farm_logs_queue');
}
