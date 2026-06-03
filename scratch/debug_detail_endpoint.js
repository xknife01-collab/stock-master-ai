import axios from 'axios';

async function test() {
    try {
        console.log('📡 Querying local detail endpoint...');
        const res = await axios.get('http://localhost:5000/api/stock-detail/detail/007660');
        console.log('Response keys:', Object.keys(res.data));
        console.log('Fundamental object:', JSON.stringify(res.data.fundamental, null, 2));
    } catch (e) {
        console.error('Error querying endpoint:', e.message);
    }
}

test();
