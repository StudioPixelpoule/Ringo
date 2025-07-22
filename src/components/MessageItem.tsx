import React from 'react';
import { Message } from '../lib/conversationStore';
import { DirectStreamingText } from './DirectStreamingText';
import { useConversationStore } from '../lib/conversationStore';
import { EnhancedMarkdown } from './EnhancedMarkdown';
import './MessageItem.css';

interface MessageItemProps {
  message: Message;
  isLatestAssistantMessage: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({ 
  message, 
  isLatestAssistantMessage 
}) => {
  const isAssistant = message.sender === 'assistant';
  const streamedMessages = useConversationStore(state => state.streamedMessages);
  
  // A message should stream only if it is:
  // 1. An assistant message
  // 2. The latest assistant message
  // 3. Not already streamed (not in streamedMessages)
  const shouldStream = isAssistant && isLatestAssistantMessage && !streamedMessages.has(message.id);
  
  const formattedTime = new Date(message.created_at).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  if (isAssistant) {
    return (
      <div className="message-item">
        <div className="message-metadata">
          <span className="message-time">{formattedTime}</span>
          <span>Ringo</span>
        </div>
        <div className="assistant-message">
          <div className="assistant-message-content">
            {shouldStream ? (
              <DirectStreamingText 
                content={message.content} 
                messageId={message.id}
                speed={4} 
              />
            ) : (
              <EnhancedMarkdown content={message.content} />
            )}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="message-item">
      <div className="message-metadata">
        <span className="message-time">{formattedTime}</span>
        <span>Vous</span>
      </div>
      <div className="user-message">
        <div className="user-message-content">
          {message.content}
        </div>
      </div>
    </div>
  );
};