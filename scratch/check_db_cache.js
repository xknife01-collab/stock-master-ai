import supabase from '../lib/supabaseClient.js';

const checkCache = async () => {
    const { data, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .eq('symbol', '000660')
        .maybeSingle();

    if (error) {
        console.error("DB Error:", error.message);
    } else {
        console.log("Cached Symbol:", data?.symbol);
        console.log("Fundamental exists:", !!data?.fundamental);
        console.log("Advanced exists:", !!data?.advanced);
        if (data?.advanced) {
            console.log("advanced.transactionValue:", data.advanced.transactionValue);
        }
    }
};

checkCache();
