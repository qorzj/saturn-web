import createClient from "openapi-fetch";
import type { paths } from "./api-schema";

// Get base URL from environment variable, fallback to production
const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://www.binfer.net";

export const apiClient = createClient<paths>({
  baseUrl,
});

// Helper to set auth token
export function setAuthToken(token: string) {
  apiClient.use({
    onRequest({ request }) {
      request.headers.set("Authorization", `Bearer ${token}`);
      return request;
    },
  });
}
