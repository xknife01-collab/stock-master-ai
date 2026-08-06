import axios from 'axios';

async function verifyLiveBackend() {
    const urls = [
        'http://localhost:5000/api/history/KOSPI?range=1D',
        'http://localhost:5000/api/history/KOSDAQ?range=1D',
        'http://localhost:5000/api/history/KOSPI200?range=1D'
    ];
    for(const url of urls) {
        try {
            console.log(`\nFetching ${url}...`);
            const res = await axios.get(url, { timeout: 10000 });
            if (Array.isArray(res.data) && res.data.length > 0) {
                console.log(`OK: ${res.data.length} points. Last Price: ${res.data[res.data.length-1].price}`);
            } else {
                console.log(`Strange response:`, JSON.stringify(res.data));
            }
        } catch(e) {
            console.error(`Error: ${e.message}`);
        }
    }
}
verifyLiveBackend();
