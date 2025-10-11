/**
 * Authentication utilities for managing JWT tokens and login state
 */

const TOKEN_KEY = 'auth_token';
const REDIRECT_KEY = 'redirect_after_login';

/**
 * Get the stored authentication token
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Store the authentication token
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Remove the authentication token (logout)
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * Save the current URL to redirect to after login
 */
export function saveRedirectUrl(url: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REDIRECT_KEY, url);
}

/**
 * Get and clear the redirect URL
 */
export function getAndClearRedirectUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const url = localStorage.getItem(REDIRECT_KEY);
  if (url) {
    localStorage.removeItem(REDIRECT_KEY);
  }
  return url;
}
