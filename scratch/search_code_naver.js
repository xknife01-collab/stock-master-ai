import axios from 'axios';

async function testNaverSearch(name) {
    try {
        // Naver Stock Search AutoComplete API
        const url = `https://ac.stock.naver.com/ac?q=${encodeURIComponent(name)}&target=stock&q_enc=utf-8&r_format=json`;
        const res = await axios.get(url);
        console.log(`Results for ${name}:`, JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error(`Failed to query Naver autocomplete for ${name}:`, e.message);
    }
}

async function run() {
    await testNaverSearch('이수페타시스');
    await testNaverSearch('삼성전자');
    await testNaverSearch('HPSP');
    await testNaverSearch('리노공업');
}

run();
