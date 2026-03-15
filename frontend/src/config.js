// Centralized API configuration for frontend
// Set VITE_API_BASE_URL in your environment (e.g. Vercel environment variable)
// Default is localhost for local development.

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";
