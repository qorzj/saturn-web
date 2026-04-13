'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiBaseUrl, apiClient } from '@/lib/api-client';
import { clearAuthToken, getAuthToken, saveRedirectUrl } from '@/lib/auth';
import { generateRandomNoteSlug } from '@/lib/note-slug';

interface ChatStatusDto {
  status: number;
  total_tokens?: number | null;
  message?: string | null;
}

function formatTokenCount(totalTokens: number | null): string {
  if (totalTokens === null) {
    return '0';
  }

  if (totalTokens < 1000) {
    return `${totalTokens}`;
  }

  return `${(totalTokens / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}

function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return fallback;
}

async function fetchChatStatus(innerSlug: string): Promise<ChatStatusDto> {
  const token = getAuthToken();
  const headers = new Headers();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const statusPaths = [
    `/api/note-status/${innerSlug}`,
    `/api/chat-status/${innerSlug}`,
  ];

  for (const statusPath of statusPaths) {
    const response = await fetch(`${apiBaseUrl}${statusPath}`, {
      method: 'GET',
      headers,
    });

    if (response.status === 404) {
      continue;
    }

    if (response.status === 401) {
      clearAuthToken();

      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname + window.location.search;
        if (currentPath !== '/login') {
          saveRedirectUrl(currentPath);
        }

        window.location.href = '/login';
      }

      throw new Error('Authentication required');
    }

    if (!response.ok) {
      let message = `Failed to fetch chat status (${response.status})`;

      try {
        const errorBody = await response.json() as { message?: string };
        if (errorBody.message) {
          message = errorBody.message;
        }
      } catch {
        // Ignore JSON parsing errors and keep the default message.
      }

      throw new Error(message);
    }

    return await response.json() as ChatStatusDto;
  }

  throw new Error('Chat status endpoint is not available');
}

export default function ChatPage() {
  const router = useRouter();
  const [userPrompt, setUserPrompt] = useState('');
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [totalTokens, setTotalTokens] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const pollInFlightRef = useRef(false);

  const formattedTokens = useMemo(() => formatTokenCount(totalTokens), [totalTokens]);

  useEffect(() => {
    if (!startedAt || (!pendingSlug && !isSubmitting)) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isSubmitting, pendingSlug, startedAt]);

  const pollStatus = useCallback(async (innerSlug: string) => {
    if (pollInFlightRef.current) {
      return;
    }

    pollInFlightRef.current = true;

    try {
      const nextStatus = await fetchChatStatus(innerSlug);

      setStatus(nextStatus.status);
      setTotalTokens(nextStatus.total_tokens ?? null);

      if (nextStatus.status === -1) {
        setPendingSlug(null);
        setErrorMessage(nextStatus.message || 'Chat generation failed');
        return;
      }

      if (nextStatus.status === 2) {
        router.replace(`/${innerSlug}`);
      }
    } catch (error) {
      const message = extractApiErrorMessage(error, 'Failed to fetch chat status');
      if (message !== 'Authentication required') {
        setPendingSlug(null);
        setStatus(-1);
        setErrorMessage(message);
      }
    } finally {
      pollInFlightRef.current = false;
    }
  }, [router]);

  useEffect(() => {
    if (!pendingSlug) {
      return;
    }

    pollStatus(pendingSlug);

    const intervalId = window.setInterval(() => {
      void pollStatus(pendingSlug);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [pendingSlug, pollStatus]);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedPrompt = userPrompt.trim();
    if (!trimmedPrompt) {
      return;
    }

    const nextSlug = generateRandomNoteSlug();

    setIsSubmitting(true);
    setStatus(0);
    setTotalTokens(null);
    setErrorMessage('');
    setStartedAt(Date.now());
    setElapsedSeconds(0);

    try {
      const { error } = await apiClient.POST('/api/note/chat', {
        body: {
          slug: nextSlug,
          userPrompt: trimmedPrompt,
        },
      });

      if (error) {
        setStatus(-1);
        setErrorMessage(extractApiErrorMessage(error, 'Failed to submit chat request'));
      } else {
        setPendingSlug(nextSlug);
      }
    } catch (error) {
      setStatus(-1);
      setErrorMessage(extractApiErrorMessage(error, 'Failed to submit chat request'));
    } finally {
      setIsSubmitting(false);
    }
  }, [userPrompt]);

  const statusContent = useMemo(() => {
    if (status === 1 && pendingSlug) {
      return (
        <p style={{
          marginTop: '16px',
          color: '#6b7280',
          fontSize: '14px',
          fontFamily: 'var(--font-geist-mono), monospace',
        }}>
          &middot; Fetching... ({elapsedSeconds}s) &middot; &darr; {formattedTokens} tokens
        </p>
      );
    }

    if (status === -1 && errorMessage) {
      return (
        <p style={{
          marginTop: '16px',
          color: '#b91c1c',
          fontSize: '14px',
        }}>
          {errorMessage}
        </p>
      );
    }

    if (isSubmitting || pendingSlug) {
      return (
        <p style={{
          marginTop: '16px',
          color: '#6b7280',
          fontSize: '14px',
        }}>
          Submitting... ({elapsedSeconds}s)
        </p>
      );
    }

    return null;
  }, [elapsedSeconds, errorMessage, formattedTokens, isSubmitting, pendingSlug, status]);

  return (
    <>
      <title>Chat - Binfer Notes</title>
      <div className="min-h-screen bg-[#f9f9f9] flex flex-col">
        <main className="flex-1">
          <div className="container mx-auto px-4">
            <div
              style={{
                minHeight: 'calc(100vh - 61px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 0',
              }}
            >
              <form
                onSubmit={handleSubmit}
                style={{
                  width: '100%',
                  maxWidth: '720px',
                }}
              >
                <textarea
                  value={userPrompt}
                  onChange={(event) => setUserPrompt(event.target.value)}
                  placeholder="Write your prompt..."
                  rows={12}
                  disabled={isSubmitting || !!pendingSlug}
                  style={{
                    width: '100%',
                    minHeight: '280px',
                    padding: '16px',
                    fontSize: '16px',
                    lineHeight: '1.6',
                    color: '#111827',
                    backgroundColor: '#ffffff',
                    border: '1px solid #9e9e9e',
                    borderRadius: '2px',
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  autoFocus
                />
                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={isSubmitting || !!pendingSlug || !userPrompt.trim()}
                    style={{
                      lineHeight: '1.5715',
                      position: 'relative',
                      display: 'inline-block',
                      fontWeight: '400',
                      whiteSpace: 'nowrap',
                      textAlign: 'center',
                      backgroundImage: 'none',
                      border: '1px solid transparent',
                      boxShadow: '0 2px rgba(0,0,0,0.015)',
                      cursor: isSubmitting || pendingSlug || !userPrompt.trim() ? 'not-allowed' : 'pointer',
                      transition: 'all .3s cubic-bezier(.645,.045,.355,1)',
                      height: '40px',
                      padding: '0 20px',
                      fontSize: '16px',
                      borderRadius: '2px',
                      borderColor: 'rgb(79, 70, 229)',
                      background: 'rgb(79, 70, 229)',
                      color: '#fff',
                      textShadow: '0 -1px 0 rgba(0,0,0,.12)',
                      opacity: isSubmitting || pendingSlug || !userPrompt.trim() ? '0.6' : '1',
                      boxSizing: 'border-box',
                    }}
                  >
                    Submit
                  </button>
                </div>
                {statusContent}
              </form>
            </div>
          </div>
        </main>

        <footer className="page-footer" style={{ backgroundColor: '#E9E9E9' }}>
          <div className="footer-copyright" style={{ padding: '10px 0' }}>
            <div className="container mx-auto px-4 text-[#9e9e9e]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              <div>
                <Link href="/how-to-use" className="text-[#626262] no-underline">
                  How to Use
                </Link>
              </div>
              <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Link href="/chat" className="text-[#626262] no-underline inline-flex items-center">
                  <i className="material-icons tiny" style={{ fontSize: '18px' }}>chat</i>
                </Link>
                <Link href="/search" className="text-[#626262] no-underline inline-flex items-center">
                  <i className="material-icons tiny" style={{ fontSize: '18px' }}>search</i>
                </Link>
              </div>
              <div />
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
