import supabase from '../lib/supabaseClient.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    console.log("Reading __ai_cache__ from stock_master_map...");
    const { data, error } = await supabase
        .from('stock_master_map')
        .select('*')
        .eq('name', '__ai_cache__')
        .maybeSingle();

    if (error) {
        console.error("Error fetching __ai_cache__:", error.message);
    } else if (data) {
        console.log("Found __ai_cache__!");
        const parsed = JSON.parse(data.code);
        console.log("hourKey:", parsed.hourKey);
        console.log("savedTime:", parsed.savedTime);
        console.log("Number of candidates:", parsed.pulse?.candidates?.length || parsed.pulse?.data?.candidates?.length || 0);
        
        // Find Hanul Semiconductor in candidates
        const candidates = parsed.pulse?.candidates || parsed.pulse?.data?.candidates || [];
        const hanul = candidates.find(c => c.name === '한울반도체');
        if (hanul) {
            console.log("Hanul Semiconductor:", {
                name: hanul.name,
                code: hanul.code,
                totalScore: hanul.totalScore,
                isVetoed: hanul.isVetoed,
                vetoReason: hanul.vetoReason,
                strength: hanul.metrics?.strength
            });
        } else {
            console.log("Hanul Semiconductor NOT found in candidates.");
        }
    } else {
        console.log("No __ai_cache__ found.");
    }
    process.exit(0);
}

run();
