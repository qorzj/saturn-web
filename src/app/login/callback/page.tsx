'use client';

import { useEffect, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { setAuthToken, getAndClearRedirectUrl } from '@/lib/auth';

function CallbackContent() {
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      // Get authorization code from URL
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setError(`Google login failed: ${errorParam}`);
        return;
      }

      if (!code) {
        setError('No authorization code received from Google');
        return;
      }

      const redirectUri = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI;
      if (!redirectUri) {
        setError('OAuth redirect URI is not configured');
        return;
      }

      try {
        // Exchange code for token
        const { data, error: apiError } = await apiClient.POST('/public/login-google-oauth2', {
          body: {
            code,
            redirectUri,
          },
        });

        if (apiError) {
          const errorData = apiError as { code?: number; message?: string };
          setError(errorData.message || 'Failed to exchange authorization code');
          return;
        }

        if (data?.token) {
          // Save token
          setAuthToken(data.token);

          // Get redirect URL from localStorage or default to home
          const redirectUrl = getAndClearRedirectUrl() || '/';

          // Redirect to target page
          router.push(redirectUrl);
        } else {
          setError('No token received from server');
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError('An unexpected error occurred during login');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9f9f9'
      }}>
        <div style={{
          maxWidth: '400px',
          padding: '40px',
          backgroundColor: '#fff',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '16px',
            color: '#c00'
          }}>
            Login Failed
          </h1>
          <p style={{
            marginBottom: '24px',
            color: '#000'
          }}>
            {error}
          </p>
          <button
            onClick={() => router.push('/login')}
            style={{
              width: '100%',
              height: '40px',
              padding: '0 20px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#fff',
              backgroundColor: '#000',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9f9f9'
    }}>
      <div style={{
        textAlign: 'center',
        color: '#000'
      }}>
        <div style={{
          fontSize: '18px',
          marginBottom: '16px'
        }}>
          Completing login...
        </div>
        <div style={{
          fontSize: '14px',
          color: '#626262'
        }}>
          Please wait while we authenticate your account.
        </div>
      </div>
    </div>
  );
}

export default function CallbackPage() {
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
      <CallbackContent />
    </Suspense>
  );
}
