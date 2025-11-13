'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import MarkdownRenderer from '@/components/markdown/MarkdownRenderer';

interface SharedNote {
  slug: string;
  contentMd: string;
  isShared: number;
  createTime: string;
  updateTime: string;
}

export default function SharedNotePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [note, setNote] = useState<SharedNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  const fetchNote = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await apiClient.GET('/public/note/{slug}', {
        params: { path: { slug } },
      });

      if (data) {
        setNote(data as SharedNote);
      } else if (error) {
        setNotFound(true);
      }
    } catch (err) {
      console.error('Failed to fetch shared note:', err);
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  const handleCopyUrl = useCallback(() => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 2000);
    }).catch(err => {
      console.error('Failed to copy URL:', err);
      alert('Failed to copy URL to clipboard');
    });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (notFound || !note) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Note Not Found</h1>
          <p className="text-muted-foreground mb-4">
            This note does not exist or is not shared.
          </p>
          <Link href="/" className="text-blue-600 hover:underline">
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  // Extract title from markdown (first H1 heading)
  const titleMatch = note.contentMd.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : 'binfer';

  return (
    <>
      <title>{title}</title>
      <div className="min-h-screen bg-[#f9f9f9] flex flex-col">
        <main className="flex-1">
          <div className="container mx-auto px-4">
            <div style={{ padding: '40px 0' }}>
              <div className="w-full">
                <div id="content-html">
                  <MarkdownRenderer content={note.contentMd} />
                </div>
              </div>
            </div>
            <div className="row">&nbsp;</div>
          </div>
        </main>
        <footer className="page-footer" style={{ backgroundColor: '#E9E9E9' }}>
          <div className="footer-copyright" style={{ padding: '10px 0' }}>
            <div className="container mx-auto px-4 text-[#9e9e9e]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Link href="/share/how-to-use" className="text-[#626262] no-underline">
                  How to Use
                </Link>
              </div>
              <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center' }}>
                {/* Empty center - no search icon for public pages */}
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {note?.contentMd && (
                  <button
                    onClick={handleCopyUrl}
                    className="text-[#626262] no-underline inline-flex items-center"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    title="Copy public URL"
                  >
                    <i className="material-icons tiny" style={{ fontSize: '18px' }}>share</i>
                  </button>
                )}
              </div>
            </div>
          </div>
        </footer>

        {/* Toast notification for copied URL */}
        {showCopiedToast && (
          <div style={{
            position: 'fixed',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#323232',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '4px',
            fontSize: '14px',
            boxShadow: '0 3px 6px rgba(0,0,0,0.3)',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease-in'
          }}>
            Link copied!
          </div>
        )}

        <style jsx>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
          }
        `}</style>
      </div>
    </>
  );
}
