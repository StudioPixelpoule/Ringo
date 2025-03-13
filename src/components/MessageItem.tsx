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
        className={`message-container ${isAssistant ? 'message-assistant' : 'message-user'}`}
        style={getAnimationStyle(index)}
      >
        <div className="message-avatar">
          {isAssistant ? (
            <div className="avatar-assistant">
              <Bot size={20} />
            </div>
          ) : (
            <div className="avatar-user">
              <User size={20} />
            </div>
          )}
        </div>
        
        <div className="message-content-wrapper">
          <div className="message-header">
            <span className="message-sender">{isAssistant ? 'Assistant' : 'Vous'}</span>
            <span className="message-time">{formattedTime}</span>
          </div>
          
          <div className={`message-bubble ${isAssistant ? 'bubble-assistant' : 'bubble-user'}`}>
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
              <div className="user-message-text">{message.content}</div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

MessageItem.displayName = 'MessageItem';