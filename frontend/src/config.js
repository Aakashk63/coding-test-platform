// Dynamically resolve API and WebSocket server URL based on deployment context
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // If running locally in the browser, point to local Express server on port 3000
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    // If hosted on Vercel, use relative paths via the same domain origin
    return window.location.origin;
  }
  return 'http://localhost:3000';
};

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || getApiBaseUrl();
export const API_URL = `${API_BASE_URL}/api`;
export const SOCKET_URL = API_BASE_URL;
