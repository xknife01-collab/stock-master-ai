// API Base URL config: dynamically resolves between the Vercel env variable and local fallback
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
