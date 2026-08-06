import axios from 'axios';

async function checkDetail() {
    try {
        const res = await axios.get('http://localhost:5000/api/stock/detail/005930');
        console.log('--- Detail API Response ---');
        console.log(JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error('API Fail:', e.message);
    }
}

checkDetail();
