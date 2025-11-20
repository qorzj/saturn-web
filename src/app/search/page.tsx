'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import MarkdownRenderer from '@/components/markdown/MarkdownRenderer';

interface SearchNote {
  slug: string;
  innerSlug?: string | null;
  contentMd: string;
  title: string;
  similarity: number;
  createTime: string;
  updateTime: string;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryParam = searchParams.get('q');

  const [query, setQuery] = useState(queryParam || '');
  const [searchResults, setSearchResults] = useState<SearchNote[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    try {
      const { data, error } = await apiClient.GET('/api/note/search', {
        params: {
          query: { query: searchQuery.trim() },
        },
      });

      if (data) {
        setSearchResults(data as SearchNote[]);
      } else if (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (queryParam) {
      performSearch(queryParam);
    }
  }, [queryParam, performSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const toggleExpand = (slug: string) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(slug)) {
        newSet.delete(slug);
      } else {
        newSet.add(slug);
      }
      return newSet;
    });
  };

  const getPreviewContent = (contentMd: string, isExpanded: boolean) => {
    if (isExpanded) return contentMd;

    const lines = contentMd.split('\n');
    if (lines.length <= 5) return contentMd;

    return lines.slice(0, 5).join('\n');
  };

  return (
    <>
      <title>{queryParam ? `${queryParam} - Search - binfer` : 'Search - binfer'}</title>
      <div className="min-h-screen bg-[#f9f9f9] flex flex-col">
        <main className="flex-1">
          <div className="container mx-auto px-4">
            <div style={{ padding: '40px 0' }}>
              {/* Search Form */}
              <div className={hasSearched ? 'mb-8' : 'flex items-center justify-center' } style={{ minHeight: hasSearched ? 'auto' : '60vh' }}>
                <div className="w-full max-w-2xl">
                  <form onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', alignItems: 'stretch' }}>
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search notes..."
                        style={{
                          flex: '1',
                          height: '40px',
                          padding: '0 15px',
                          fontSize: '16px',
                          border: '1px solid #9e9e9e',
                          borderRight: 'none',
                          borderRadius: '2px 0 0 2px',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={isSearching || !query.trim()}
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
                          cursor: query.trim() && !isSearching ? 'pointer' : 'not-allowed',
                          transition: 'all .3s cubic-bezier(.645,.045,.355,1)',
                          height: '40px',
                          padding: '0 20px',
                          fontSize: '16px',
                          borderRadius: '0 2px 2px 0',
                          borderColor: 'rgb(79, 70, 229)',
                          background: 'rgb(79, 70, 229)',
                          color: '#fff',
                          textShadow: '0 -1px 0 rgba(0,0,0,.12)',
                          opacity: query.trim() && !isSearching ? '1' : '0.6',
                          boxSizing: 'border-box',
                        }}
                      >
                        {isSearching ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Search Results */}
              {hasSearched && (
                <div className="w-full max-w-4xl mx-auto">
                  {isSearching ? (
                    <div className="text-center py-8">
                      <p className="text-[#9e9e9e]">Searching...</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div>
                      <p className="text-[#9e9e9e] mb-4">
                        Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                      </p>
                      <div className="space-y-6">
                        {searchResults.map((note) => {
                          const isExpanded = expandedNotes.has(note.slug);
                          const previewContent = getPreviewContent(note.contentMd, isExpanded);
                          const needsExpand = note.contentMd.split('\n').length > 5;

                          return (
                            <div
                              key={note.slug}
                              className="bg-white border border-gray-200 rounded-sm p-4"
                              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                            >
                              {/* Title/Link */}
                              <h3 className="mb-2">
                                <Link
                                  href={`/${note.innerSlug || note.slug}`}
                                  className="text-[#1a0dab] text-xl hover:underline"
                                  style={{ fontWeight: '400' }}
                                >
                                  {note.title}
                                </Link>
                              </h3>

                              {/* URL */}
                              <div className="mb-2">
                                <Link
                                  href={`/${note.innerSlug || note.slug}`}
                                  className="text-[#006621] text-sm no-underline"
                                >
                                  {typeof window !== 'undefined' ? window.location.origin : ''}/{note.innerSlug || note.slug}
                                </Link>
                              </div>

                              {/* Content Preview */}
                              <div
                                className="text-sm"
                                style={{
                                  maxHeight: isExpanded ? 'none' : '150px',
                                  overflow: 'hidden',
                                  position: 'relative'
                                }}
                              >
                                <MarkdownRenderer content={previewContent} allowRawHtml={false} />
                                {!isExpanded && needsExpand && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      bottom: 0,
                                      left: 0,
                                      right: 0,
                                      height: '40px',
                                      background: 'linear-gradient(to bottom, transparent, white)',
                                    }}
                                  />
                                )}
                              </div>

                              {/* Expand/Collapse Button */}
                              {needsExpand && (
                                <button
                                  onClick={() => toggleExpand(note.slug)}
                                  className="text-[#1a0dab] text-sm mt-2 hover:underline"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {isExpanded ? 'Show less' : 'Show more'}
                                </button>
                              )}

                              {/* Metadata */}
                              <div className="text-[#9e9e9e] text-xs mt-2">
                                {new Date(note.updateTime).toLocaleDateString()} · Similarity: {(note.similarity * 100).toFixed(1)}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-[#9e9e9e]">
                        No results found for &quot;{queryParam}&quot;
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="page-footer" style={{ backgroundColor: '#E9E9E9' }}>
          <div className="footer-copyright" style={{ padding: '10px 0' }}>
            <div className="container mx-auto px-4 text-[#9e9e9e]">
              <Link href="/how-to-use" className="text-[#626262] no-underline">
                How to Use
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f9f9f9] flex items-center justify-center">
        <p className="text-[#9e9e9e]">Loading...</p>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
