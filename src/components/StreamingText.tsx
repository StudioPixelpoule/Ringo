import React, { useState, useEffect } from 'react';
import { EnhancedMarkdown } from './EnhancedMarkdown';

interface StreamingTextProps {
  content: string;
  speed?: number;
}

export const StreamingText: React.FC<StreamingTextProps> = ({ 
  content, 
  speed = 3
}) => {
  const [displayedContent, setDisplayedContent] = useState('');
  
  useEffect(() => {
    // Reset when content changes
    setDisplayedContent('');
    
    if (!content) return;
    
    let index = 0;
    const characters = content.split('');
    
    // Markdown structure preservation
    const preserveMarkdownStructure = (text: string, currentPosition: number) => {
      // Track open Markdown elements
      const openElements = {
        codeBlock: text.slice(0, currentPosition).split('```').length % 2 === 1,
        inlineCode: text.slice(0, currentPosition).split('`').length % 2 === 1,
        bold: text.slice(0, currentPosition).split('**').length % 2 === 1,
        italic: text.slice(0, currentPosition).split('*').length % 2 === 1 && 
                !text.slice(0, currentPosition).includes('**'),
        link: text.slice(0, currentPosition).split('[').length > 
              text.slice(0, currentPosition).split(']').length,
        heading: /^#{1,6}\s/.test(text.slice(0, currentPosition).split('\n').pop() || '')
      };
      
      let result = text.slice(0, currentPosition);
      
      // Close open elements for proper rendering
      if (openElements.codeBlock) {
        const nextBlock = text.slice(currentPosition).indexOf('```');
        if (nextBlock !== -1) {
          result += text.slice(currentPosition, currentPosition + nextBlock + 3);
        }
      }
      
      if (openElements.inlineCode) {
        const nextTick = text.slice(currentPosition).indexOf('`');
        if (nextTick !== -1) {
          result += text.slice(currentPosition, currentPosition + nextTick + 1);
        }
      }
      
      if (openElements.bold) {
        const nextBold = text.slice(currentPosition).indexOf('**');
        if (nextBold !== -1) {
          result += text.slice(currentPosition, currentPosition + nextBold + 2);
        }
      }
      
      if (openElements.italic) {
        const nextItalic = text.slice(currentPosition).indexOf('*');
        if (nextItalic !== -1) {
          result += text.slice(currentPosition, currentPosition + nextItalic + 1);
        }
      }
      
      if (openElements.link) {
        const linkPattern = /\](.*?\))/;
        const linkMatch = text.slice(currentPosition).match(linkPattern);
        if (linkMatch) {
          result += `]${linkMatch[1]}`;
        }
      }
      
      if (openElements.heading) {
        const currentLine = text.slice(0, currentPosition).split('\n').pop() || '';
        if (/^#{1,6}\s/.test(currentLine) && currentLine.length < 20) {
          const nextNewline = text.slice(currentPosition).indexOf('\n');
          if (nextNewline !== -1) {
            result += text.slice(currentPosition, currentPosition + nextNewline);
          }
        }
      }
      
      return result;
    };
    
    const addNextCharacter = () => {
      if (index >= characters.length) {
        return;
      }
      
      // Add next character while preserving Markdown structure
      const nextContent = preserveMarkdownStructure(content, index + 1);
      setDisplayedContent(nextContent);
      index++;
      
      // Natural typing speed variations
      let adjustedSpeed = speed + Math.random() * 4 - 2; // ±2ms variation
      
      // Contextual pauses
      const currentChar = characters[index - 1];
      const nextChar = characters[index];
      
      // Longer pauses after sentences
      if (['.', '!', '?'].includes(currentChar)) {
        adjustedSpeed += 200;
        // Even longer pause if it's the end of a paragraph
        if (nextChar === '\n') {
          adjustedSpeed += 100;
        }
      }
      // Medium pauses for clause breaks
      else if ([',', ';', ':'].includes(currentChar)) {
        adjustedSpeed += 100;
      }
      // Short pauses for natural word breaks
      else if (currentChar === ' ') {
        adjustedSpeed += 20;
      }
      
      // Pause before lists and code blocks
      if (nextChar === '-' || nextChar === '*' || nextChar === '`') {
        adjustedSpeed += 50;
      }
      
      // Pause before headings
      if (nextChar === '#') {
        adjustedSpeed += 150;
      }
      
      // Pause between paragraphs
      if (currentChar === '\n' && nextChar === '\n') {
        adjustedSpeed += 300;
      }
      
      setTimeout(addNextCharacter, Math.max(1, adjustedSpeed));
    };
    
    // Start the animation
    addNextCharacter();
    
    // Cleanup
    return () => {
      index = characters.length;
    };
  }, [content, speed]);
  
  return (
    <div className="streaming-text">
      <EnhancedMarkdown content={displayedContent} />
    </div>
  );
};