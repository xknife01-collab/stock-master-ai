import supabase from '../lib/supabaseClient.js';

async function check() {
    if (!supabase) {
        console.error("Supabase client not initialized.");
        return;
    }
    try {
        const { data, error } = await supabase
            .from('stock_master_map')
            .select('*')
            .eq('name', '__kis_token__')
            .maybeSingle();

        if (error) {
            console.error("Supabase Error:", error.message);
            return;
        }

        if (data) {
            console.log("KIS TOKEN ENTRY IN SUPABASE:", JSON.stringify(data, null, 2));
            const codeObj = JSON.parse(data.code);
            console.log("Token Expires (KST):", new Date(codeObj.tokenExpires).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
        } else {
            console.log("No KIS token found in Supabase.");
        }
    } catch (e) {
        console.error("Exception:", e.message);
    }
}

check();
