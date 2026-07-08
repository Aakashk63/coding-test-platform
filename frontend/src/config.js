// API and WebSocket Server Configuration for Render Backend
export const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'https://coding-test-platform-1.onrender.com';
export const API_URL = `${API_BASE_URL}/api`;
export const SOCKET_URL = API_BASE_URL;
