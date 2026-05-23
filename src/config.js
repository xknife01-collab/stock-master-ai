const getFallbackUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:5000';
  const { protocol, hostname, port } = window.location;
  // If frontend runs on Vite dev server (usually 5173), target the backend on port 5000 of the same host (IP)
  if (port && port !== '5000') {
    return `${protocol}//${hostname}:5000`;
  }
  return window.location.origin;
};

export const API_URL = import.meta.env.VITE_API_URL || getFallbackUrl();
