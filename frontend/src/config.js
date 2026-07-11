// API and WebSocket Server Configuration for Render Backend
export const API_BASE_URL = 
  import.meta.env.VITE_API_URL || 
  import.meta.env.VITE_API_BASE_URL || 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : 'https://coding-test-platform-1.onrender.com');
export const API_URL = `${API_BASE_URL}/api`;
export const SOCKET_URL = API_BASE_URL;
