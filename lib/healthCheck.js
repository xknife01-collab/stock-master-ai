/**
 * Server Health & Status Diagnostic Module
 * Obeying Rule 2 (Code Splitting & Modularization Mandate)
 */

export const getSystemStatus = () => {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotalMB = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
    const rssMB = (memoryUsage.rss / 1024 / 1024).toFixed(2);
    const uptimeSec = Math.floor(process.uptime());

    return {
        status: 'ok',
        service: 'Stock Master AI Backend Server',
        uptimeSeconds: uptimeSec,
        timestamp: new Date().toISOString(),
        memory: {
            heapUsedMB: `${heapUsedMB} MB`,
            heapTotalMB: `${heapTotalMB} MB`,
            rssMB: `${rssMB} MB`
        },
        env: {
            nodeEnv: process.env.NODE_ENV || 'development',
            hasGeminiKey: !!process.env.GEMINI_API_KEY,
            hasGoogleCloudProject: !!process.env.GOOGLE_CLOUD_PROJECT
        }
    };
};
