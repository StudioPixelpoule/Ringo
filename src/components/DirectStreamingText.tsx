import React, { useState, useEffect, useRef } from 'react';
import { useConversationStore } from '../lib/conversationStore';
import { EnhancedMarkdown } from './EnhancedMarkdown';
import './DirectStreamingText.css';

interface DirectStreamingTextProps {
  content: string;
  messageId: string;
  speed?: number;
}

export const DirectStreamingText: React.FC<DirectStreamingTextProps> = ({ 
  content, 
  messageId,
  speed = 4 
}) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const markMessageAsViewed = useConversationStore(state => state.markMessageAsViewed);
  
  useEffect(() => {
    // Reset when content changes
    setDisplayedContent('');
    setIsComplete(false);
    
    if (!content) return;
    
    let index = 0;
    const characters = content.split('');
    
    // Track Markdown structure
    const markdownState = {
      inCodeBlock: false,
      inBold: false,
      inItalic: false,
      inLink: false,
      inHeading: false,
      inList: false
    };
    
    const interval = window.setInterval(() => {
      if (index >= characters.length) {
        clearInterval(interval);
        setIsComplete(true);
        markMessageAsViewed(messageId);
        return;
      }
      
      // Get next character and look ahead
      const char = characters[index];
      const nextChars = characters.slice(index, index + 3).join('');
      
      // Update Markdown state
      if (nextChars === '```') {
        markdownState.inCodeBlock = !markdownState.inCodeBlock;
        index += 3;
      } else if (nextChars === '**') {
        markdownState.inBold = !markdownState.inBold;
        index += 2;
      } else if (char === '*' && !markdownState.inBold) {
        markdownState.inItalic = !markdownState.inItalic;
        index++;
      } else if (char === '[') {
        markdownState.inLink = true;
        index++;
      } else if (char === ')' && markdownState.inLink) {
        markdownState.inLink = false;
        index++;
      } else if (char === '#' && !markdownState.inHeading) {
        markdownState.inHeading = true;
        index++;
      } else if (char === '\n') {
        markdownState.inHeading = false;
        index++;
      } else {
        // Regular character
        setDisplayedContent(prev => prev + char);
        index++;
      }
      
      // Adjust speed based on context
      if (char === '.' || char === '!' || char === '?') {
        // Longer pause after sentences
        clearInterval(interval);
        setTimeout(() => {
          const newInterval = window.setInterval(() => {
            if (index >= characters.length) {
              clearInterval(newInterval);
              setIsComplete(true);
              markMessageAsViewed(messageId);
              return;
            }
            
            setDisplayedContent(prev => prev + characters[index]);
            index++;
          }, speed);
        }, 300);
      }
    }, speed);
    
    return () => {
      clearInterval(interval);
    };
  }, [content, speed, messageId, markMessageAsViewed]);
  
  return (
    <div className="streaming-text-container">
      {isComplete ? (
        <EnhancedMarkdown content={content} />
      ) : (
        <div className="streaming-text">
          <EnhancedMarkdown content={displayedContent} />
          <span className="typing-cursor" />
        </div>
      )}
    </div>
  );
};