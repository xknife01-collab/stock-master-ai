import axios from 'axios';

async function test() {
    try {
        const res = await axios.get('http://localhost:5000/api/dashboard');
        console.log('Keys:', Object.keys(res.data));
        console.log('Full Sectors:', res.data.sectors);
        console.log('Full Themes:', res.data.themes);
        console.log('Full Foreign:', res.data.foreign?.[0]);
    } catch (e) {
        console.error(e.response?.data || e.message);
    }
}
test();
