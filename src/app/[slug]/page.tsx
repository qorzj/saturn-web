'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import MarkdownRenderer from '@/components/markdown/MarkdownRenderer';
import { uploadImageToQiniu } from '@/lib/qiniu-upload';

interface Note {
  slug: string;
  innerSlug?: string | null;
  contentMd: string;
  title: string;
  isShared: number;
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
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchNote = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await apiClient.GET('/mgr/note/{inner_slug}', {
        params: { path: { inner_slug: slug } },
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

  // Auto-resize textarea only when entering edit mode (not on every content change)
  useEffect(() => {
    if (isEditing) {
      const textarea = document.getElementById('content-md') as HTMLTextAreaElement;
      if (textarea) {
        // Use setTimeout to ensure the textarea is rendered with current content
        setTimeout(() => {
          textarea.style.height = 'auto';
          textarea.style.height = Math.max(200, textarea.scrollHeight) + 'px';
        }, 0);
      }
    }
  }, [isEditing]); // Only depend on isEditing, not contentMd

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    isSavingRef.current = true;
    try {
      const { error } = await apiClient.POST('/api/note/save', {
        body: {
          slug,
          contentMd: contentMd.trim(),
          isShared: (note?.isShared ?? 0) as 0 | 1, // Keep existing share status or default to private
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
  }, [slug, contentMd, note?.isShared]);

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

  const handleDelete = useCallback(async () => {
    if (!note) return;

    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      const { error } = await apiClient.DELETE('/mgr/note/{slug}', {
        params: { path: { slug: note.slug } },
      });

      if (!error) {
        // Reload the page with the same slug (will create a new empty note)
        window.location.reload();
      } else {
        alert('Failed to delete note');
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
      alert('Failed to delete note');
    }
  }, [note]);

  const handleToggleShare = useCallback(async () => {
    if (!note) return;

    const newIsShared = note.isShared === 1 ? 0 : 1;
    const action = newIsShared === 1 ? 'share' : 'unshare';

    if (!confirm(`Are you sure you want to ${action} this note?`)) {
      return;
    }

    try {
      const { error } = await apiClient.POST('/api/note/save', {
        body: {
          slug,
          contentMd: note.contentMd,
          isShared: newIsShared as 0 | 1,
        },
      });

      if (!error) {
        // Reload to show updated share status
        window.location.reload();
      } else {
        alert(`Failed to ${action} note`);
      }
    } catch (err) {
      console.error(`Failed to ${action} note:`, err);
      alert(`Failed to ${action} note`);
    }
  }, [slug, note]);

  const handleCopyShareUrl = useCallback(() => {
    if (!note || note.isShared !== 1) return;

    const shareUrl = `${window.location.origin}/share/${note.slug}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 2000);
    }).catch(err => {
      console.error('Failed to copy URL:', err);
      alert('Failed to copy URL to clipboard');
    });
  }, [note]);

  // Handle paste event for image upload
  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Prevent uploading new images while another upload is in progress
    if (isUploading) {
      e.preventDefault();
      return;
    }

    const items = e.clipboardData?.items;
    if (!items) return;

    // Find image in clipboard
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();

        const file = item.getAsFile();
        if (!file) continue;

        setIsUploading(true);

        try {
          // Upload image to Qiniu
          const imageUrl = await uploadImageToQiniu(file);

          // Insert markdown image at cursor position
          const textarea = textareaRef.current;
          if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const markdownImage = `![img](${imageUrl})`;
            const newContent = contentMd.substring(0, start) + markdownImage + contentMd.substring(end);

            setContentMd(newContent);
            setHasUnsavedChanges(true);

            // Set cursor position after the inserted image
            setTimeout(() => {
              const newCursorPos = start + markdownImage.length;
              textarea.setSelectionRange(newCursorPos, newCursorPos);
              textarea.focus();
            }, 0);
          }
        } catch (err) {
          console.error('Failed to upload image:', err);
          alert(err instanceof Error ? err.message : 'Failed to upload image');
        } finally {
          setIsUploading(false);
        }

        break;
      }
    }
  }, [contentMd]);

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
                        ref={textareaRef}
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
                        onPaste={handlePaste}
                        onChange={(e) => {
                          const target = e.target;
                          const cursorPosition = target.selectionStart;

                          handleContentChange(e);

                          // Auto-resize textarea while preserving cursor position
                          requestAnimationFrame(() => {
                            const currentHeight = target.scrollHeight;
                            const newHeight = Math.max(200, currentHeight);

                            // Only update height if it actually needs to change
                            if (target.style.height !== `${newHeight}px`) {
                              target.style.height = 'auto';
                              target.style.height = `${newHeight}px`;

                              // Restore cursor position
                              target.setSelectionRange(cursorPosition, cursorPosition);
                            }
                          });
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
                          value={isSaving ? 'Saving...' : isUploading ? 'Uploading image...' : 'Save markdown'}
                          disabled={isSaving || isUploading}
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
            <div className="container mx-auto px-4 text-[#9e9e9e]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link href="/share/how-to-use" className="text-[#626262] no-underline">
                  How to Use
                </Link>
                {!isEditing && note?.contentMd && (
                  <button
                    onClick={handleEdit}
                    className="text-[#626262] no-underline inline-flex items-center"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    title="Edit note"
                  >
                    <i className="material-icons tiny" style={{ fontSize: '18px' }}>edit</i>
                  </button>
                )}
              </div>
              <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center' }}>
                <Link href="/search" className="text-[#626262] no-underline inline-flex items-center">
                  <i className="material-icons tiny" style={{ fontSize: '18px' }}>search</i>
                </Link>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {note?.contentMd && (
                  <>
                    <button
                      onClick={handleToggleShare}
                      className="text-[#626262] no-underline inline-flex items-center"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                      title={note.isShared === 1 ? 'Unshare note (currently shared)' : 'Share note (currently private)'}
                    >
                      <i className="material-icons tiny" style={{ fontSize: '18px' }}>
                        {note.isShared === 1 ? 'lock_open' : 'lock'}
                      </i>
                    </button>
                    {note.isShared === 1 && (
                      <button
                        onClick={handleCopyShareUrl}
                        className="text-[#626262] no-underline inline-flex items-center"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                        title="Copy share link"
                      >
                        <i className="material-icons tiny" style={{ fontSize: '18px' }}>share</i>
                      </button>
                    )}
                    <button
                      onClick={handleDelete}
                      className="text-[#626262] no-underline inline-flex items-center"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                      title="Delete note"
                    >
                      <i className="material-icons tiny" style={{ fontSize: '18px' }}>delete</i>
                    </button>
                  </>
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
