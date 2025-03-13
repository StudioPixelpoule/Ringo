import React from 'react';
import { User, Bot } from 'lucide-react';
import { Message } from '../lib/conversationStore';
import { DirectStreamingText } from './DirectStreamingText';
import { useConversationStore } from '../lib/conversationStore';
import { EnhancedMarkdown } from './EnhancedMarkdown';
import { useMessageAnimation } from '../lib/hooks/useMessageAnimation';

interface MessageItemProps {
  message: Message;
  isLatestAssistantMessage: boolean;
  index: number;
}

export const MessageItem = React.memo<MessageItemProps>(
  ({ message, isLatestAssistantMessage, index }) => {
    const isAssistant = message.sender === 'assistant';
    const streamedMessages = useConversationStore(state => state.streamedMessages);
    const shouldStream = isAssistant && isLatestAssistantMessage && !streamedMessages.has(message.id);
    const { getAnimationStyle } = useMessageAnimation();
    
    const formattedTime = new Date(message.created_at).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    return (
      <div 
        className={`message-item ${isAssistant ? 'assistant-message' : 'user-message'}`}
        style={getAnimationStyle(index)}
      >
        <div className="message-metadata">
          <span className="message-time">{formattedTime}</span>
          <span>{isAssistant ? 'Assistant' : 'Vous'}</span>
        </div>
        
        <div className={`message-content ${isAssistant ? 'assistant-message-content' : 'user-message-content'}`}>
          {isAssistant ? (
            shouldStream ? (
              <DirectStreamingText 
                content={message.content} 
                messageId={message.id}
                speed={4} 
              />
            ) : (
              <EnhancedMarkdown content={message.content} />
            )
          ) : (
            message.content
          )}
        </div>
      </div>
    );
  }
);

MessageItem.displayName = 'MessageItem';