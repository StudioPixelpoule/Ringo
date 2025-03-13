import React, { useRef, useEffect } from 'react';
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
  const sizeMap = useRef<{[key: string]: number}>({});
  
  // Get the last assistant message index
  const lastAssistantMessageIndex = messages
    .map((m, i) => ({ ...m, index: i }))
    .filter(m => m.sender === 'assistant')
    .pop()?.index;

  // Function to estimate message height
  const getMessageHeight = (index: number) => {
    const message = messages[index];
    const messageId = message.id;
    
    if (sizeMap.current[messageId]) {
      return sizeMap.current[messageId];
    }
    
    // Estimate based on content length and type
    const baseHeight = 60; // Base height for metadata
    const contentLength = message.content.length;
    const linesEstimate = Math.ceil(contentLength / 50); // Assume 50 chars per line
    
    // Assistant messages might have markdown and need more space
    const heightPerLine = message.sender === 'assistant' ? 24 : 20;
    const estimatedHeight = baseHeight + (linesEstimate * heightPerLine);
    
    sizeMap.current[messageId] = estimatedHeight;
    return estimatedHeight;
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(messages.length - 1, 'end');
    }
  }, [messages.length]);

  // Reset size cache when messages change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  }, [messages]);

  const Row = ({ index, style }: { index: number, style: React.CSSProperties }) => {
    const message = messages[index];
    return (
      <div style={style}>
        <MessageItem
          message={message}
          isLatestAssistantMessage={index === lastAssistantMessageIndex}
        />
      </div>
    );
  };

  return (
    <List
      ref={listRef}
      className={`messages-list ${className}`}
      height={600} // This will be overridden by CSS
      width="100%"
      itemCount={messages.length}
      itemSize={getMessageHeight}
      overscanCount={5} // Number of items to render outside visible area
    >
      {Row}
    </List>
  );
};