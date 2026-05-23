const getFallbackUrl = () => {
  if (typeof window === 'undefined') return 'https://stock-master-ai.onrender.com';
  const { protocol, hostname, port } = window.location;
  
  // Detect if we are running in local development or local network testing
  const isLocal = hostname === 'localhost' || 
                  hostname === '127.0.0.1' || 
                  hostname.startsWith('192.168.') || 
                  hostname.startsWith('10.') || 
                  hostname.startsWith('172.');
                  
  if (isLocal) {
    return `${protocol}//${hostname}:5000`;
  }
  
  // Production fallback: Point to the live Render backend
  return 'https://stock-master-ai.onrender.com';
};

export const API_URL = import.meta.env.VITE_API_URL || getFallbackUrl();
