import axios from 'axios';

async function compare() {
    try {
        const res1 = await axios.get('http://localhost:5000/api/stock-detail/detail/005930');
        const res2 = await axios.get('http://localhost:5000/api/stock-detail/detail/000660');
        console.log('005930:', JSON.stringify(res1.data.fundamental.per));
        console.log('000660:', JSON.stringify(res2.data.fundamental.per));
    } catch (e) {
        console.error('Fetch failed:', e.message);
    }
}

compare();
