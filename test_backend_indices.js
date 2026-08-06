import axios from 'axios';

async function testBackendIndices() {
    const symbols = ['KOSPI', 'KOSDAQ', 'KOSPI200'];
    for (const sym of symbols) {
        try {
            console.log(`\nTesting ${sym}...`);
            const res = await axios.get(`http://localhost:5000/api/stock/history/${sym}?range=1D`);
            if (res.data && res.data.length > 0) {
                console.log(`Last Price for ${sym}:`, res.data[res.data.length - 1].price);
            } else {
                console.log(`No data for ${sym}`);
            }
        } catch (e) {
            console.error(`Error for ${sym}:`, e.message);
        }
    }
}

testBackendIndices();
