'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import MarkdownRenderer from '@/components/markdown/MarkdownRenderer';

interface Note {
  slug: string;
  contentMd: string;
  title: string;
  isLocked: number;
  uv: number;
}

export default function NotePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [note, setNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [contentMd, setContentMd] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isSavingRef = useRef(false);

  const fetchNote = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await apiClient.GET('/mgr/note/{slug}', {
        params: { path: { slug } },
      });

      if (data) {
        setNote(data as Note);
        setContentMd(data.contentMd || '');
        if (!data.contentMd) {
          setIsEditing(true); // Auto-enter edit mode for new notes
        }
      } else if (error) {
        // Note doesn't exist yet, create new one
        setNote(null);
        setContentMd('');
        setIsEditing(true);
      }
    } catch (err) {
      console.error('Failed to fetch note:', err);
      setNote(null);
      setContentMd('');
      setIsEditing(true);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Don't show warning if we're saving
      if (hasUnsavedChanges && !isSavingRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Auto-resize textarea on mount and when entering edit mode
  useEffect(() => {
    if (isEditing) {
      const textarea = document.getElementById('content-md') as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(200, textarea.scrollHeight) + 'px';
      }
    }
  }, [isEditing, contentMd]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    isSavingRef.current = true;
    try {
      const { error } = await apiClient.POST('/api/note/save', {
        body: {
          slug,
          contentMd: contentMd.trim(),
          isLocked: 0,
        },
      });

      if (!error) {
        setHasUnsavedChanges(false);
        // Refresh the page to show rendered content
        window.location.reload();
      } else {
        alert('Failed to save note');
        isSavingRef.current = false;
      }
    } catch (err) {
      console.error('Failed to save note:', err);
      alert('Failed to save note');
      isSavingRef.current = false;
    } finally {
      setIsSaving(false);
    }
  }, [slug, contentMd]);

  // Command+Enter to save
  useEffect(() => {
    if (!isEditing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, handleSave]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setContentMd(note?.contentMd || '');
    setIsEditing(false);
    setHasUnsavedChanges(false);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContentMd(e.target.value);
    setHasUnsavedChanges(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const title = note?.title || 'binfer';

  return (
    <>
      <title>{title}</title>
      <div className="min-h-screen bg-[#f9f9f9] flex flex-col">
        <main className="flex-1">
          <div className="container mx-auto px-4">
            <div style={{ padding: '40px 0' }}>
              <div className="w-full">
                {!isEditing && note?.contentMd ? (
                  <div id="content-html">
                    <MarkdownRenderer content={note.contentMd} />
                  </div>
                ) : (
                  <div id="content-md-edit">
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                      <input type="hidden" name="slug" value={slug} />
                      <textarea
                        name="content_md"
                        id="content-md"
                        className="materialize-textarea"
                        style={{
                          padding: '10px',
                          minHeight: '200px',
                          width: '100%',
                          border: '1px solid #9e9e9e',
                          borderRadius: '0',
                          fontSize: '14px',
                          lineHeight: '1.5',
                          fontFamily: 'monospace',
                          resize: 'vertical',
                          overflow: 'hidden',
                          boxSizing: 'border-box'
                        }}
                        value={contentMd}
                        onChange={(e) => {
                          handleContentChange(e);
                          // Auto-resize textarea
                          e.target.style.height = 'auto';
                          e.target.style.height = Math.max(200, e.target.scrollHeight) + 'px';
                        }}
                        placeholder="Enter markdown content..."
                      />
                      <div style={{ marginTop: '16px' }}>
                        {note?.contentMd && (
                          <>
                            <button
                              type="button"
                              onClick={handleCancel}
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
                                cursor: 'pointer',
                                transition: 'all .3s cubic-bezier(.645,.045,.355,1)',
                                height: '32px',
                                padding: '4px 15px',
                                fontSize: '14px',
                                borderRadius: '2px',
                                borderColor: '#d9d9d9',
                                background: '#fff',
                                color: 'rgba(0,0,0,.85)'
                              }}
                            >
                              <span>Cancel</span>
                            </button>
                            &nbsp;
                          </>
                        )}
                        <input
                          className="btn-primary"
                          type="submit"
                          value={isSaving ? 'Saving...' : 'Save markdown'}
                          disabled={isSaving}
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
                            cursor: 'pointer',
                            transition: 'all .3s cubic-bezier(.645,.045,.355,1)',
                            height: '32px',
                            padding: '4px 15px',
                            fontSize: '14px',
                            borderRadius: '2px',
                            borderColor: '#d9d9d9',
                            background: 'rgb(79, 70, 229)',
                            color: '#fff',
                            textShadow: '0 -1px 0 rgba(0,0,0,.12)'
                          }}
                        />
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
            <div className="row">&nbsp;</div>
          </div>
        </main>
        <footer className="page-footer" style={{ backgroundColor: '#E9E9E9' }}>
          <div className="footer-copyright" style={{ padding: '10px 0' }}>
            <div className="container mx-auto px-4 text-[#9e9e9e]">
              <Link href="/how-to-use" className="text-[#626262] no-underline">
                How to Use
              </Link>
              {!note?.isLocked && !isEditing && note?.contentMd && (
                <>
                  {' '}
                  <button
                    onClick={handleEdit}
                    className="text-[#626262] no-underline inline-flex items-center"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    <i className="material-icons tiny" style={{ fontSize: '18px' }}>edit</i>
                  </button>
                </>
              )}
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
