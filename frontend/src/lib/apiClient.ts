import axios from 'axios';
import { supabase } from './supabase'; // Import your configured Supabase client

// Create an Axios instance
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api', // Use environment variable or default
  // withCredentials: true, // Keep if needed for other non-JWT auth, but JWT is usually header-based
});

// Add a request interceptor to include the JWT token
apiClient.interceptors.request.use(
  async (config) => {
    // Get the current session from Supabase
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('Error getting Supabase session:', error);
      // Handle error appropriately, maybe redirect to login or show error
      return Promise.reject(error);
    }

    // If a session exists and has an access token, add it to the Authorization header
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    } else {
      // Handle case where there's no session/token (optional, depends on API requirements)
      // If the endpoint requires auth, the backend middleware will reject it anyway.
      console.log('No active session found, request sent without Authorization header.');
    }

    return config;
  },
  (error) => {
    // Handle request error
    console.error('Axios request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Optional: Add a response interceptor for handling common errors (like 401 Unauthorized)
apiClient.interceptors.response.use(
  (response) => {
    // Any status code that lie within the range of 2xx cause this function to trigger
    return response;
  },
  (error) => {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    if (error.response && error.response.status === 401) {
      // Handle unauthorized errors, e.g., redirect to login
      console.error('Unauthorized request - potentially expired token:', error.response);
      // Example: Trigger logout or redirect
      // window.location.href = '/login'; // Or use react-router navigation
    }
    return Promise.reject(error);
  }
);


export default apiClient;
