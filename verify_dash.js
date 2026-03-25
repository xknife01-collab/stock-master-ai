import axios from 'axios';
async function runTest() {
    try {
        const res = await axios.get('http://localhost:5000/api/dashboard');
        console.log('Keys:', Object.keys(res.data));
        console.log('Foreign:', JSON.stringify(res.data.foreign).substring(0, 100));
    } catch(e) { console.error(e.message); }
}
runTest();
