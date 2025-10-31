'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { useEffect, useState } from 'react';

interface MarkdownRendererProps {
  content: string;
  allowRawHtml?: boolean;
}

export default function MarkdownRenderer({ content, allowRawHtml = true }: MarkdownRendererProps) {
  const containsMath = content.includes('$$') || content.includes('$');

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[
          ...(allowRawHtml ? [rehypeRaw] : []),
          rehypeHighlight,
          ...(containsMath ? [rehypeKatex] : []),
        ]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';

            // Render mermaid diagrams (code blocks only have language- prefix)
            if (className && language === 'mermaid') {
              const code = String(children).replace(/\n$/, '');
              return <MermaidDiagram code={code} />;
            }

            // Default code block rendering
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function MermaidDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const renderDiagram = async () => {
      try {
        const mermaid = (await import('mermaid')).default;

        // Initialize mermaid with configuration
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
        });

        // Generate unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;

        // Render the diagram
        const { svg } = await mermaid.render(id, code);
        setSvg(svg);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
        console.error('Mermaid render error:', err);
      }
    };

    renderDiagram();
  }, [code]);

  if (error) {
    return (
      <div style={{
        color: '#d32f2f',
        padding: '10px',
        border: '1px solid #f44336',
        borderRadius: '4px',
        backgroundColor: '#ffebee',
        marginTop: '1em',
        marginBottom: '1em',
      }}>
        <strong>Mermaid Error:</strong> {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div style={{
        padding: '10px',
        color: '#666',
        fontStyle: 'italic',
      }}>
        Loading diagram...
      </div>
    );
  }

  return (
    <div
      className="mermaid-diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{ marginTop: '1em', marginBottom: '1em' }}
    />
  );
}
