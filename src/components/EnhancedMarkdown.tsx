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
          h1: ({ node, ...props }) => <h1 className="prose-h1" {...props} />,
          h2: ({ node, ...props }) => <h2 className="prose-h2" {...props} />,
          h3: ({ node, ...props }) => <h3 className="prose-h3" {...props} />,
          h4: ({ node, ...props }) => <h4 className="prose-h4" {...props} />,
          h5: ({ node, ...props }) => <h5 className="prose-h5" {...props} />,
          h6: ({ node, ...props }) => <h6 className="prose-h6" {...props} />,
          p: ({ node, ...props }) => <p className="prose-p" {...props} />,
          a: ({ node, ...props }) => <a className="prose-link" target="_blank" rel="noopener noreferrer" {...props} />,
          blockquote: ({ node, ...props }) => <blockquote className="prose-blockquote" {...props} />,
          ul: ({ node, ...props }) => <ul className="prose-list" {...props} />,
          ol: ({ node, ...props }) => <ol className="prose-list" {...props} />,
          li: ({ node, ...props }) => <li className="prose-list-item" {...props} />,
          table: ({ node, ...props }) => <div className="table-container"><table className="prose-table" {...props} /></div>,
          thead: ({ node, ...props }) => <thead className="prose-thead" {...props} />,
          tbody: ({ node, ...props }) => <tbody className="prose-tbody" {...props} />,
          tr: ({ node, ...props }) => <tr className="prose-tr" {...props} />,
          th: ({ node, ...props }) => <th className="prose-th" {...props} />,
          td: ({ node, ...props }) => <td className="prose-td" {...props} />,
          em: ({ node, ...props }) => <em className="prose-em" {...props} />,
          strong: ({ node, ...props }) => <strong className="prose-strong" {...props} />,
          hr: ({ node, ...props }) => <hr className="prose-hr" {...props} />,
          img: ({ node, src, alt, ...props }) => (
            <div className="prose-image-container">
              <img src={src} alt={alt} className="prose-img" loading="lazy" {...props} />
              {alt && <span className="prose-img-caption">{alt}</span>}
            </div>
          ),
          code: ({ node, inline, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter
                style={atomDark}
                language={match[1]}
                PreTag="div"
                className="prose-code-block"
                showLineNumbers={true}
                wrapLines={true}
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={`prose-code ${className || ''}`} {...props}>
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