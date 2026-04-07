'use client';

import Editor, { type OnMount } from '@monaco-editor/react';
import { useEffect, useState, useCallback, useRef, type ClipboardEvent as ReactClipboardEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { editor as MonacoEditor } from 'monaco-editor';
import { apiClient } from '@/lib/api-client';
import MarkdownRenderer from '@/components/markdown/MarkdownRenderer';
import { updateMarkdownTaskState } from '@/lib/markdown-task-list';
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
  const [editorHeight, setEditorHeight] = useState(200);
  const isSavingRef = useRef(false);
  const hasUnsavedChangesRef = useRef(false);
  const skipBeforeUnloadRef = useRef(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const isUploadingRef = useRef(false);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const handleSaveRef = useRef<() => Promise<void>>(async () => {});
  const pasteCleanupRef = useRef<(() => void) | null>(null);
  const contentSizeCleanupRef = useRef<{ dispose: () => void } | null>(null);

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

  useEffect(() => {
    isUploadingRef.current = isUploading;
  }, [isUploading]);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (skipBeforeUnloadRef.current) {
        return;
      }

      if (hasUnsavedChangesRef.current && !isSavingRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (isEditing && editorRef.current) {
      editorRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    return () => {
      pasteCleanupRef.current?.();
      contentSizeCleanupRef.current?.dispose();
    };
  }, []);

  const updateEditorHeight = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const nextHeight = Math.max(200, editor.getContentHeight());
    setEditorHeight((currentHeight) => (
      Math.abs(currentHeight - nextHeight) < 1 ? currentHeight : nextHeight
    ));
  }, []);

  const saveNoteContent = useCallback(async (nextContentMd: string, nextIsShared?: 0 | 1) => {
    setIsSaving(true);
    isSavingRef.current = true;

    try {
      const { error } = await apiClient.POST('/api/note/save', {
        body: {
          slug,
          contentMd: nextContentMd,
          isShared: nextIsShared ?? ((note?.isShared ?? 0) as 0 | 1),
        },
      });

      if (!error) {
        setHasUnsavedChanges(false);
        hasUnsavedChangesRef.current = false;
        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.error('Failed to save note:', err);
      return false;
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  }, [slug, note?.isShared]);

  const handleSave = useCallback(async () => {
    const saved = await saveNoteContent(contentMd.trim());

    if (saved) {
      skipBeforeUnloadRef.current = true;
      window.location.reload();
    } else {
      alert('Failed to save note');
    }
  }, [contentMd, saveNoteContent]);

  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

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
    hasUnsavedChangesRef.current = false;
  };

  const handleContentChange = useCallback((nextContentMd: string) => {
    skipBeforeUnloadRef.current = false;
    setContentMd(nextContentMd);
    setHasUnsavedChanges(true);
    hasUnsavedChangesRef.current = true;
  }, []);

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
        skipBeforeUnloadRef.current = true;
        window.location.reload();
      } else {
        alert('Failed to delete note');
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
      alert('Failed to delete note');
    }
  }, [note]);

  const handleTaskToggle = useCallback(async (taskIndex: number, checked: boolean) => {
    if (!note || isSaving) return;

    const previousContent = note.contentMd;
    const nextContent = updateMarkdownTaskState(previousContent, taskIndex, checked);

    if (nextContent === previousContent) {
      return;
    }

    setNote((currentNote) => {
      if (!currentNote) return currentNote;
      return { ...currentNote, contentMd: nextContent };
    });
    setContentMd(nextContent);

    const saved = await saveNoteContent(nextContent);

    if (!saved) {
      setNote((currentNote) => {
        if (!currentNote) return currentNote;
        return { ...currentNote, contentMd: previousContent };
      });
      setContentMd(previousContent);
      alert('Failed to update task status');
    }
  }, [isSaving, note, saveNoteContent]);

  const handleToggleShare = useCallback(async () => {
    if (!note) return;

    const newIsShared = note.isShared === 1 ? 0 : 1;
    const action = newIsShared === 1 ? 'share' : 'unshare';

    if (!confirm(`Are you sure you want to ${action} this note?`)) {
      return;
    }

    try {
      const saved = await saveNoteContent(note.contentMd, newIsShared as 0 | 1);

      if (saved) {
        // Reload to show updated share status
        skipBeforeUnloadRef.current = true;
        window.location.reload();
      } else {
        alert(`Failed to ${action} note`);
      }
    } catch (err) {
      console.error(`Failed to ${action} note:`, err);
      alert(`Failed to ${action} note`);
    }
  }, [note, saveNoteContent]);

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

  const handleEditorPaste = useCallback(async (event: ClipboardEvent) => {
    if (isUploadingRef.current) {
      event.preventDefault();
      return;
    }

    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (!item.type.startsWith('image/')) {
        continue;
      }

      event.preventDefault();

      const file = item.getAsFile();
      if (!file) {
        return;
      }

      setIsUploading(true);

      try {
        const imageUrl = await uploadImageToQiniu(file);
        const editor = editorRef.current;
        const model = editor?.getModel();
        const selection = editor?.getSelection();

        if (!editor || !model || !selection) {
          return;
        }

        const markdownImage = `![img](${imageUrl})`;
        const startOffset = model.getOffsetAt(selection.getStartPosition());

        editor.executeEdits('image-upload', [
          {
            range: selection,
            text: markdownImage,
            forceMoveMarkers: true,
          },
        ]);

        const nextPosition = model.getPositionAt(startOffset + markdownImage.length);
        editor.setPosition(nextPosition);
        editor.focus();
      } catch (err) {
        console.error('Failed to upload image:', err);
        alert(err instanceof Error ? err.message : 'Failed to upload image');
      } finally {
        setIsUploading(false);
      }

      return;
    }
  }, []);

  const handleEditorDidMount = useCallback<OnMount>((editor, monaco) => {
    editorRef.current = editor;
    editor.focus();
    updateEditorHeight();

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      void handleSaveRef.current();
    });

    const domNode = editor.getDomNode();
    if (!domNode) {
      return;
    }

    contentSizeCleanupRef.current?.dispose();
    contentSizeCleanupRef.current = editor.onDidContentSizeChange(() => {
      updateEditorHeight();
    });

    pasteCleanupRef.current?.();
    domNode.addEventListener('paste', handleEditorPaste, true);
    pasteCleanupRef.current = () => {
      domNode.removeEventListener('paste', handleEditorPaste, true);
    };
  }, [handleEditorPaste, updateEditorHeight]);

  useEffect(() => {
    if (isEditing) {
      updateEditorHeight();
    }
  }, [contentMd, isEditing, updateEditorHeight]);

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
                    <MarkdownRenderer
                      content={note.contentMd}
                      onTaskToggle={handleTaskToggle}
                      isTaskTogglePending={isSaving}
                    />
                  </div>
                ) : (
                  <div id="content-md-edit">
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                      <input type="hidden" name="slug" value={slug} />
                      <div
                        onPasteCapture={(event: ReactClipboardEvent<HTMLDivElement>) => {
                          void handleEditorPaste(event.nativeEvent);
                        }}
                        style={{
                          minHeight: '200px',
                          width: '100%',
                          border: '1px solid #9e9e9e',
                          borderRadius: '0',
                          overflow: 'hidden',
                          boxSizing: 'border-box',
                        }}
                      >
                        <Editor
                          height={`${editorHeight}px`}
                          defaultLanguage="plaintext"
                          value={contentMd}
                          onMount={handleEditorDidMount}
                          onChange={(value) => handleContentChange(value ?? '')}
                          loading="Loading editor..."
                          options={{
                            automaticLayout: true,
                            fontSize: 14,
                            fontFamily: 'monospace',
                            lineHeight: 21,
                            lineNumbers: 'off',
                            lineDecorationsWidth: 10,
                            lineNumbersMinChars: 0,
                            glyphMargin: false,
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            tabFocusMode: false,
                            tabSize: 2,
                            insertSpaces: true,
                            renderLineHighlight: 'none',
                            renderLineHighlightOnlyWhenFocus: false,
                            hideCursorInOverviewRuler: true,
                            overviewRulerBorder: false,
                            selectionHighlight: false,
                            occurrencesHighlight: 'off',
                            wordWrap: 'on',
                            wrappingIndent: 'same',
                            quickSuggestions: false,
                            suggestOnTriggerCharacters: false,
                            folding: false,
                            padding: {
                              top: 10,
                              bottom: 10,
                            },
                            cursorSurroundingLines: 0,
                            cursorStyle: 'line',
                            smoothScrolling: true,
                            guides: {
                              indentation: false,
                            },
                            overviewRulerLanes: 0,
                            scrollbar: {
                              alwaysConsumeMouseWheel: false,
                              vertical: 'hidden',
                              horizontal: 'hidden',
                              handleMouseWheel: false,
                              verticalScrollbarSize: 0,
                              horizontalScrollbarSize: 0,
                            },
                          }}
                        />
                      </div>
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
