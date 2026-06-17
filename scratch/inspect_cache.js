import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';

async function inspect() {
    const { data, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .limit(1);
    if (error) {
        console.error(error);
    } else {
        console.log(JSON.stringify(data[0], null, 2));
    }
}
inspect();
