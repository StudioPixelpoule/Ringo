import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface EnhancedMarkdownProps {
  content: string;
  className?: string;
}

export const EnhancedMarkdown: React.FC<EnhancedMarkdownProps> = ({ content, className = '' }) => {
  return (
    <div className={`enhanced-markdown ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          h1: ({ node, ...props }) => <h1 className="markdown-h1" {...props} />,
          h2: ({ node, ...props }) => <h2 className="markdown-h2" {...props} />,
          h3: ({ node, ...props }) => <h3 className="markdown-h3" {...props} />,
          h4: ({ node, ...props }) => <h4 className="markdown-h4" {...props} />,
          h5: ({ node, ...props }) => <h5 className="markdown-h5" {...props} />,
          h6: ({ node, ...props }) => <h6 className="markdown-h6" {...props} />,
          p: ({ node, ...props }) => <p className="markdown-p" {...props} />,
          a: ({ node, ...props }) => <a className="markdown-link" target="_blank" rel="noopener noreferrer" {...props} />,
          blockquote: ({ node, ...props }) => <blockquote className="markdown-blockquote" {...props} />,
          ul: ({ node, ...props }) => <ul className="markdown-ul" {...props} />,
          ol: ({ node, ...props }) => <ol className="markdown-ol" {...props} />,
          li: ({ node, ...props }) => <li className="markdown-li" {...props} />,
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-gray-200">
              <table className="w-full" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => <thead className="bg-gray-50" {...props} />,
          th: ({ node, ...props }) => <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900" {...props} />,
          td: ({ node, ...props }) => <td className="px-4 py-2 text-sm text-gray-700 border-t border-gray-200" {...props} />,
          em: ({ node, ...props }) => <em className="italic text-gray-600" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900" {...props} />,
          hr: ({ node, ...props }) => <hr className="my-6 border-t border-gray-200" {...props} />,
          img: ({ node, src, alt, ...props }) => (
            <div className="my-4 text-center">
              <img src={src} alt={alt} className="inline-block max-w-full rounded-lg shadow-md" loading="lazy" {...props} />
              {alt && <span className="block mt-2 text-sm text-gray-500">{alt}</span>}
            </div>
          ),
          code: ({ node, inline, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter
                style={atomDark}
                language={match[1]}
                PreTag="div"
                className="rounded-lg text-sm"
                showLineNumbers={true}
                wrapLines={true}
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={`markdown-code ${className || ''}`} {...props}>
                {children}
              </code>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};