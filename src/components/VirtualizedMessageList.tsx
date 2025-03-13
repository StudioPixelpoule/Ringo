import React, { useRef, useEffect, useState } from 'react';
import { VariableSizeList as List } from 'react-window';
import { Message } from '../lib/conversationStore';
import { MessageItem } from './MessageItem';

interface VirtualizedMessageListProps {
  messages: Message[];
  className?: string;
}

export const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({ 
  messages,
  className = ''
}) => {
  const listRef = useRef<List>(null);
  const sizeCache = useRef<{[key: string]: number}>({});
  const [listHeight, setListHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get the last assistant message index
  const lastAssistantMessageIndex = messages
    .map((m, i) => ({ ...m, index: i }))
    .filter(m => m.sender === 'assistant')
    .pop()?.index;

  // Update list height on container resize
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setListHeight(entry.contentRect.height);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Function to estimate message height
  const getMessageHeight = (index: number) => {
    const message = messages[index];
    const messageId = message.id;
    
    if (sizeCache.current[messageId]) {
      return sizeCache.current[messageId];
    }
    
    // Base height for metadata and padding
    const baseHeight = 60;
    
    // Estimate based on content length and type
    const contentLength = message.content.length;
    const charsPerLine = 80; // Assume 80 chars per line
    const linesEstimate = Math.ceil(contentLength / charsPerLine);
    
    // Assistant messages need more space for markdown
    const heightPerLine = message.sender === 'assistant' ? 24 : 20;
    
    // Add extra space for markdown elements
    let extraHeight = 0;
    if (message.sender === 'assistant') {
      // Count headings
      const headings = (message.content.match(/^#{1,6}\s/gm) || []).length;
      extraHeight += headings * 40;
      
      // Count code blocks
      const codeBlocks = (message.content.match(/```[\s\S]*?```/g) || []).length;
      extraHeight += codeBlocks * 60;
      
      // Count lists
      const lists = (message.content.match(/^[-*]\s/gm) || []).length;
      extraHeight += lists * 25;
    }
    
    const estimatedHeight = baseHeight + (linesEstimate * heightPerLine) + extraHeight;
    sizeCache.current[messageId] = estimatedHeight;
    
    return estimatedHeight;
  };

  // Reset size cache when messages change
  useEffect(() => {
    sizeCache.current = {};
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(messages.length - 1, 'end');
    }
  }, [messages.length]);

  const Row = React.memo(({ index, style }: { index: number, style: React.CSSProperties }) => {
    const message = messages[index];
    return (
      <div 
        id={`message-${message.id}`}
        style={{
          ...style,
          paddingLeft: '1rem',
          paddingRight: '1rem'
        }}
      >
        <MessageItem
          message={message}
          isLatestAssistantMessage={index === lastAssistantMessageIndex}
          index={index}
        />
      </div>
    );
  });
  
  Row.displayName = 'MessageRow';

  return (
    <div 
      ref={containerRef} 
      className={`messages-list ${className}`}
      style={{ height: '100%', width: '100%' }}
    >
      <List
        ref={listRef}
        height={listHeight}
        width="100%"
        itemCount={messages.length}
        itemSize={getMessageHeight}
        overscanCount={5}
        className="scrollbar-custom"
      >
        {Row}
      </List>
    </div>
  );
};