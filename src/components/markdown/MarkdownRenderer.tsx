'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { useEffect } from 'react';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const containsMath = content.includes('$$') || content.includes('$');
  const containsMermaid = content.includes('```mermaid');

  useEffect(() => {
    // Load Mermaid if needed
    if (containsMermaid) {
      import('mermaid').then((mermaid) => {
        mermaid.default.initialize({ startOnLoad: true });
        mermaid.default.run();
      });
    }
  }, [containsMermaid, content]);

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[
          rehypeRaw,
          rehypeHighlight,
          ...(containsMath ? [rehypeKatex] : []),
        ]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
