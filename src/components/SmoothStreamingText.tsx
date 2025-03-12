import React, { useState, useEffect, useRef } from 'react';
import { EnhancedMarkdown } from './EnhancedMarkdown';
import './SmoothStreamingText.css';

interface SmoothStreamingTextProps {
  content: string;
  speed?: number;
}

export const SmoothStreamingText: React.FC<SmoothStreamingTextProps> = ({ 
  content, 
  speed = 3 
}) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const plainTextRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Reset when content changes
    setDisplayedContent('');
    setIsComplete(false);
    
    if (!content) return;
    
    let index = 0;
    const characters = content.split('');
    let interval: number;
    
    const addNextCharacter = () => {
      if (index >= characters.length) {
        // Animation complete
        clearInterval(interval);
        // Wait a moment before showing formatted Markdown
        setTimeout(() => {
          setIsComplete(true);
        }, 100);
        return;
      }
      
      // Add next character
      setDisplayedContent(prev => prev + characters[index]);
      index++;
    };
    
    // Start animation with fixed interval to avoid rendering issues
    interval = window.setInterval(addNextCharacter, speed);
    
    return () => {
      clearInterval(interval);
    };
  }, [content, speed]);
  
  // Keep scroll position synchronized
  useEffect(() => {
    if (plainTextRef.current) {
      plainTextRef.current.scrollTop = plainTextRef.current.scrollHeight;
    }
  }, [displayedContent]);
  
  return (
    <div className="streaming-container">
      {/* Layer 1: Plain text for streaming animation (visible during streaming) */}
      <div 
        ref={plainTextRef}
        className={`plain-text-layer ${isComplete ? 'hidden' : ''}`}
      >
        {displayedContent}
      </div>
      
      {/* Layer 2: Formatted Markdown (visible only at the end) */}
      <div className={`markdown-layer ${isComplete ? 'visible' : ''}`}>
        <EnhancedMarkdown content={content} />
      </div>
    </div>
  );
};