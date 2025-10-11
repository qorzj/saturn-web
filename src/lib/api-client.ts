import createClient from "openapi-fetch";
import type { paths } from "./api-schema";
import { getAuthToken, clearAuthToken, saveRedirectUrl } from "./auth";

// Get base URL from environment variable, fallback to production
const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://www.binfer.net";

export const apiClient = createClient<paths>({
  baseUrl,
});

// Request interceptor: Add Bearer token to all requests
apiClient.use({
  onRequest({ request }) {
    const token = getAuthToken();
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    return request;
  },
});

// Response interceptor: Handle 401 errors globally
apiClient.use({
  onResponse({ response }) {
    if (response.status === 401) {
      // Clear invalid token
      clearAuthToken();

      // Only redirect if in browser context
      if (typeof window !== 'undefined') {
        // Save current page for redirect after login
        const currentPath = window.location.pathname + window.location.search;
        if (currentPath !== '/login') {
          saveRedirectUrl(currentPath);
        }

        // Redirect to login page
        window.location.href = '/login';
      }
    }
    return response;
  },
});
