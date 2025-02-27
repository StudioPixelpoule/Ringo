import React, { useState } from 'react';
import { marked } from 'marked';
import { Message } from '../lib/types';
import { RingoLogo } from './RingoLogo';
import { TypewriterText } from './TypewriterText';

interface ChatMessageProps {
  message: Message;
  isLast: boolean;
  isTyping?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLast, isTyping = false }) => {
  const isUser = message.role === 'user';
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);

  // Only animate the last assistant message
  const shouldAnimate = !isUser && isLast && !isAnimationComplete && !isTyping;

  // Function to format document shared messages
  const formatDocumentMessage = (content: string) => {
    if (content.includes("**Document partagé:**")) {
      // Extract the document name
      const docName = content.replace("**Document partagé:** ", "");
      return `Document: ${docName}`;
    }
    return content;
  };

  // Parse markdown for assistant messages
  const renderContent = () => {
    if (isUser) {
      return formatDocumentMessage(message.content);
    }

    if (shouldAnimate) {
      return (
        <TypewriterText 
          text={message.content} 
          speed={20}
          onComplete={() => setIsAnimationComplete(true)}
        />
      );
    } else {
      // Parse markdown for completed messages
      const html = marked.parse(message.content);
      return (
        <div 
          className="markdown-content" 
          dangerouslySetInnerHTML={{ __html: html }} 
        />
      );
    }
  };

  return (
    <div 
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      id={isLast ? 'last-message' : undefined}
    >
      <div 
        className={`
          max-w-[80%] p-3 rounded-lg
          ${isUser 
            ? 'bg-[#cfd3bd] text-[#2F4F4F] rounded-tr-none' 
            : 'bg-transparent text-[#2F4F4F]'
          }
          transition-all duration-300 ease-in-out
        `}
      >
        <div className="flex items-start gap-3">
          {!isUser && (
            <div className="flex-shrink-0 mt-1">
              <RingoLogo size={24} className="text-[#2F4F4F]" />
            </div>
          )}
          <div className="flex-1">
            {!isUser && (
              <div className="font-medium mb-1">
                Ringo
              </div>
            )}
            <div className={`whitespace-pre-wrap ${!isUser ? 'markdown-message' : ''}`}>
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};