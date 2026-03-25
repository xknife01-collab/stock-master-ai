import axios from 'axios';

async function testDash() {
    try {
        const res = await axios.get('http://localhost:5000/api/dashboard');
        console.log('--- DASHBOARD DATA STATUS ---');
        console.log('Sectors count:', res.data.sectors.length);
        console.log('Themes count:', res.data.themes.length);
        console.log('Foreign rankings:', res.data.foreign[0].length, '/', res.data.foreign[1].length);
        console.log('Inst rankings:', res.data.inst[0].length, '/', res.data.inst[1].length);
        if (res.data.foreign[0][0]) {
            console.log('Sample Foreign Buy:', res.data.foreign[0][0].name, res.data.foreign[0][0].price);
        }
        if (res.data.sectors[0]) {
            console.log('Sample Sector:', res.data.sectors[0].name, res.data.sectors[0].change, res.data.sectors[0].width);
        }
    } catch (e) {
        console.error('Test Dash Error:', e.message);
    }
}

testDash();
