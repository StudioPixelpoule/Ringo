import React, { useState, useEffect } from 'react';
import { marked } from 'marked';

interface TypewriterTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({ 
  text, 
  speed = 20, // Vitesse modérée pour l'effet typewriter
  onComplete
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  // Split text into chunks for faster typing (words + punctuation)
  const chunks = text.split(/(\s+|\.|,|;|:|\?|!)/g).filter(Boolean);

  useEffect(() => {
    // Reset when text changes
    setDisplayedText('');
    setCurrentIndex(0);
    setIsComplete(false);
  }, [text]);

  useEffect(() => {
    if (currentIndex < chunks.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + chunks[currentIndex]);
        setCurrentIndex(prevIndex => prevIndex + 1);
      }, speed);
      
      return () => clearTimeout(timeout);
    } else if (!isComplete) {
      setIsComplete(true);
      onComplete?.();
    }
  }, [currentIndex, chunks, speed, isComplete, onComplete]);

  // Parse markdown for the displayed text
  const html = marked.parse(displayedText);
  
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
};