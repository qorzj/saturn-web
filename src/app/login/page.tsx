'use client';

import { useState, FormEvent, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { setAuthToken, getAndClearRedirectUrl, isAuthenticated } from '@/lib/auth';

function LoginForm() {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // If already logged in, redirect immediately
    if (isAuthenticated()) {
      const redirect = getAndClearRedirectUrl() || '/';
      router.replace(redirect);
    }
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: apiError } = await apiClient.POST('/public/login', {
        body: {
          userName,
          password,
        },
      });

      if (apiError) {
        // Handle error response from API
        const errorData = apiError as { code?: number; message?: string };
        setError(errorData.message || 'Login failed. Please check your credentials.');
        setLoading(false);
        return;
      }

      if (data?.token) {
        // Save token
        setAuthToken(data.token);

        // Get redirect URL from localStorage or query params
        const redirectFromStorage = getAndClearRedirectUrl();
        const redirectFromQuery = searchParams.get('redirect');
        const redirectUrl = redirectFromStorage || redirectFromQuery || '/';

        // Redirect to target page
        router.push(redirectUrl);
      } else {
        setError('Login failed: No token received');
        setLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9f9f9'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '40px',
        backgroundColor: '#fff',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          marginBottom: '24px',
          textAlign: 'center',
          color: '#000'
        }}>
          Login to Binfer Notes
        </h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="userName"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#000'
              }}
            >
              Username
            </label>
            <input
              id="userName"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
              autoComplete="username"
              style={{
                width: '100%',
                height: '40px',
                padding: '0 12px',
                fontSize: '14px',
                border: '1px solid #9e9e9e',
                borderRadius: '2px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#000'
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: '100%',
                height: '40px',
                padding: '0 12px',
                fontSize: '14px',
                border: '1px solid #9e9e9e',
                borderRadius: '2px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '12px',
              marginBottom: '20px',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '2px',
              color: '#c00',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '40px',
              padding: '0 20px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#fff',
              backgroundColor: loading ? '#9e9e9e' : '#000',
              border: 'none',
              borderRadius: '2px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div style={{
          marginTop: '20px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#626262'
        }}>
          <Link
            href="/"
            className="no-underline"
            style={{ color: '#626262' }}
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9f9f9'
      }}>
        <div>Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
