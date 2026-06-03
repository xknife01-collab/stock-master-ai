import { spawn } from 'child_process';
import axios from 'axios';

console.log('🚀 Spawning local backend server...');
const server = spawn('node', ['server.js'], {
    env: { ...process.env, PORT: '6002' }, // Use 6002 to avoid conflicts
    stdio: 'pipe'
});

server.stdout.on('data', (data) => {
    console.log(`[Server Out] ${data.toString().trim()}`);
});

server.stderr.on('data', (data) => {
    console.error(`[Server Err] ${data.toString().trim()}`);
});

setTimeout(async () => {
    console.log('\n📡 Querying local endpoint: http://localhost:6002/api/ai/pulse...');
    try {
        const start = Date.now();
        const res = await axios.get('http://localhost:6002/api/ai/pulse', { timeout: 15000 });
        const duration = Date.now() - start;
        console.log(`✅ Success in ${duration}ms!`);
        console.log('Response status:', res.status);
        console.log('Response body keys:', Object.keys(res.data));
        console.log('Time field:', res.data.time);
        
        if (res.data.data) {
            const d = res.data.data;
            console.log(`🤖 Theme: ${d.theme}`);
            console.log(`🤖 TOP PICK: ${d.stock} (${d.symbol})`);
            console.log(`🤖 Short picks count: ${d.shortTermPicks ? d.shortTermPicks.length : 0}`);
            if (d.shortTermPicks && d.shortTermPicks.length > 0) {
                console.log('First short pick:', d.shortTermPicks[0]);
            }
        } else {
            console.warn('⚠️ No data field in response:', res.data);
        }
    } catch (err) {
        console.error('❌ Request failed:', err.message);
    } finally {
        console.log('Stopping local backend server...');
        server.kill();
        process.exit(0);
    }
}, 5000);
