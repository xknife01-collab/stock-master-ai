import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';

(async () => {
    const { data, error } = await supabase
        .from('stock_master_map')
        .select('code')
        .eq('name', '__ai_cache__')
        .maybeSingle();
    if (error) {
        console.error("Error fetching __ai_cache__:", error);
    } else {
        const cache = JSON.parse(data?.code || '{}');
        console.log("DB __ai_cache__ details:");
        console.log("HourKey:", cache.hourKey);
        console.log("SavedTime:", cache.savedTime);
        console.log("Stock:", cache.pulse?.stock);
        console.log("Symbol:", cache.pulse?.symbol);
        console.log("Candidates Count:", cache.pulse?.candidates ? cache.pulse.candidates.length : 'undefined');
        if (cache.pulse?.candidates && cache.pulse.candidates.length > 0) {
            console.log("First Candidate Name:", cache.pulse.candidates[0].name);
        }
        console.log("ShortTermPicks:", JSON.stringify(cache.pulse?.shortTermPicks, null, 2));
    }
    process.exit(0);
})();
