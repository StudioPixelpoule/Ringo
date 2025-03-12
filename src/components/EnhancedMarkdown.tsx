import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './EnhancedMarkdown.css';

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
          table: ({ node, ...props }) => <div className="table-container"><table className="markdown-table" {...props} /></div>,
          thead: ({ node, ...props }) => <thead className="markdown-thead" {...props} />,
          tbody: ({ node, ...props }) => <tbody className="markdown-tbody" {...props} />,
          tr: ({ node, ...props }) => <tr className="markdown-tr" {...props} />,
          th: ({ node, ...props }) => <th className="markdown-th" {...props} />,
          td: ({ node, ...props }) => <td className="markdown-td" {...props} />,
          em: ({ node, ...props }) => <em className="markdown-em" {...props} />,
          strong: ({ node, ...props }) => <strong className="markdown-strong" {...props} />,
          hr: ({ node, ...props }) => <hr className="markdown-hr" {...props} />,
          img: ({ node, src, alt, ...props }) => (
            <div className="markdown-image-container">
              <img src={src} alt={alt} className="markdown-img" loading="lazy" {...props} />
              {alt && <span className="markdown-img-caption">{alt}</span>}
            </div>
          ),
          code: ({ node, inline, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter
                style={atomDark}
                language={match[1]}
                PreTag="div"
                className="markdown-code-block"
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