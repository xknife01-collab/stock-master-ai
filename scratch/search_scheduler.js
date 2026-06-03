import cron from 'node-cron';
console.log('Testing node-cron timezone option...');
try {
    const task = cron.schedule('*/5 * * * *', () => {
        console.log('Tick');
    }, {
        scheduled: true,
        timezone: "Asia/Seoul"
    });
    console.log('node-cron timezone option is supported!');
    task.stop();
    process.exit(0);
} catch (err) {
    console.error('node-cron timezone error:', err.message);
    process.exit(1);
}
