import axios from 'axios';

async function testHistory() {
    try {
        const res = await axios.get('http://localhost:5000/api/history/KOSPI?range=1M');
        console.log('--- KOSPI HISTORY STATUS ---');
        console.log('Data length:', res.data.length);
        if (res.data[0]) {
            console.log('First point:', res.data[0]);
            console.log('Last point:', res.data[res.data.length-1]);
        }
    } catch (e) {
        console.error('Test History Error:', e.message);
    }
}

testHistory();
