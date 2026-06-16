import fs from 'fs';
import path from 'path';

const cachePath = path.resolve(process.cwd(), 'supply_cache.json');

const defaultCache = {
    ai_supply: "",
    dashboard_9000_buy: [],
    dashboard_9000_sell: [],
    dashboard_1000_buy: [],
    dashboard_1000_sell: [],
    dashboard_volume_rank: [],
    dashboard_fluctuation_rank: []
};

const readCache = () => {
    try {
        if (fs.existsSync(cachePath)) {
            return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading supply cache:', e.message);
    }
    return defaultCache;
};

const writeCache = (data) => {
    try {
        fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Error writing supply cache:', e.message);
    }
};

export const getSupplyCache = (key) => {
    const cache = readCache();
    return cache[key] || defaultCache[key];
};

export const saveSupplyCache = (key, data) => {
    const cache = readCache();
    cache[key] = data;
    writeCache(cache);
};
