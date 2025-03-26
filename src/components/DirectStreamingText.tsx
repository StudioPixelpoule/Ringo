import React, { useState, useEffect, useRef } from 'react';
import { useConversationStore } from '../lib/conversationStore';
import { EnhancedMarkdown } from './EnhancedMarkdown';
import './DirectStreamingText.css';

interface DirectStreamingTextProps {
  content: string;
  messageId: string;
  onStreamingComplete?: () => void;
  speed?: number;
}

export const DirectStreamingText: React.FC<DirectStreamingTextProps> = ({ 
  content, 
  messageId,
  onStreamingComplete,
  speed = 4 
}) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const markMessageAsStreamed = useConversationStore(state => state.markMessageAsStreamed);
  const contentRef = useRef(content);
  const streamingIdRef = useRef(messageId);
  
  useEffect(() => {
    // If message ID changes, reset everything
    if (messageId !== streamingIdRef.current) {
      setDisplayedContent('');
      setIsComplete(false);
      contentRef.current = content;
      streamingIdRef.current = messageId;
    }
    
    if (!content) return;
    
    let isMounted = true;
    let index = 0;
    const characters = content.split('');
    
    // Track Markdown structure
    const markdownState = {
      codeBlock: false,
      inlineCode: false,
      bold: false,
      italic: false,
      link: false,
      heading: false,
      list: false,
      blockquote: false
    };
    
    const getNextChunk = () => {
      let chunk = '';
      let shouldPause = false;
      let currentChar = '';
      
      while (index < characters.length && !shouldPause) {
        currentChar = characters[index];
        const nextChars = characters.slice(index, index + 3).join('');
        const prevChar = index > 0 ? characters[index - 1] : '';
        
        // Handle Markdown syntax
        if (nextChars === '```') {
          markdownState.codeBlock = !markdownState.codeBlock;
          chunk += nextChars;
          index += 3;
          shouldPause = true;
        } else if (nextChars.startsWith('**')) {
          markdownState.bold = !markdownState.bold;
          chunk += '**';
          index += 2;
        } else if (currentChar === '`' && !markdownState.codeBlock) {
          markdownState.inlineCode = !markdownState.inlineCode;
          chunk += currentChar;
          index++;
        } else if (currentChar === '*' && !markdownState.bold && prevChar !== '*') {
          markdownState.italic = !markdownState.italic;
          chunk += currentChar;
          index++;
        } else if (currentChar === '[' && !markdownState.link) {
          markdownState.link = true;
          chunk += currentChar;
          index++;
        } else if (currentChar === ']' && markdownState.link) {
          // Capture the entire link syntax
          const linkEnd = content.indexOf(')', index);
          if (linkEnd > -1) {
            chunk += content.slice(index, linkEnd + 1);
            index = linkEnd + 1;
          }
          markdownState.link = false;
        } else if (currentChar === '#' && (prevChar === '\n' || index === 0)) {
          // Capture entire heading
          const headingEnd = content.indexOf('\n', index);
          if (headingEnd > -1) {
            chunk += content.slice(index, headingEnd + 1);
            index = headingEnd + 1;
          } else {
            chunk += content.slice(index);
            index = characters.length;
          }
          shouldPause = true;
        } else if (currentChar === '-' && (prevChar === '\n' || index === 0)) {
          // Capture entire list item
          const itemEnd = content.indexOf('\n', index);
          if (itemEnd > -1) {
            chunk += content.slice(index, itemEnd + 1);
            index = itemEnd + 1;
          } else {
            chunk += content.slice(index);
            index = characters.length;
          }
          shouldPause = true;
        } else if (currentChar === '>' && (prevChar === '\n' || index === 0)) {
          // Capture entire blockquote line
          const quoteEnd = content.indexOf('\n', index);
          if (quoteEnd > -1) {
            chunk += content.slice(index, quoteEnd + 1);
            index = quoteEnd + 1;
          } else {
            chunk += content.slice(index);
            index = characters.length;
          }
          shouldPause = true;
        } else {
          // Regular character
          chunk += currentChar;
          index++;
          
          // Natural pauses
          if (currentChar === '.' || currentChar === '!' || currentChar === '?') {
            shouldPause = true;
          } else if (currentChar === ',' || currentChar === ';') {
            shouldPause = Math.random() > 0.5;
          } else if (currentChar === ' ') {
            shouldPause = Math.random() > 0.8;
          }
        }
      }
      
      return { chunk, shouldPause, currentChar };
    };
    
    const processNextChunk = () => {
      if (!isMounted || index >= characters.length) {
        if (isMounted) {
          setIsComplete(true);
          markMessageAsStreamed(messageId);
          onStreamingComplete?.();
        }
        return;
      }
      
      const { chunk, shouldPause, currentChar } = getNextChunk();
      
      if (isMounted) {
        setDisplayedContent(prev => prev + chunk);
      }
      
      const delay = shouldPause ? 
        currentChar === '.' || currentChar === '!' || currentChar === '?' ? 300 : 
        currentChar === ',' || currentChar === ';' ? 150 :
        currentChar === ' ' ? 50 : speed
        : speed;
      
      setTimeout(processNextChunk, delay);
    };
    
    processNextChunk();
    
    return () => {
      isMounted = false;
    };
  }, [content, messageId, speed, markMessageAsStreamed, onStreamingComplete]);
  
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