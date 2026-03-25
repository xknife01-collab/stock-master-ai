import axios from 'axios';

async function debugDetail() {
    try {
        const res = await axios.get('http://localhost:5000/api/stock-detail/detail/005930');
        console.log('Detail for 005930:', JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error('Fetch failed:', e.message);
    }
}

debugDetail();
