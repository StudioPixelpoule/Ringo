import React, { useState, useEffect, useRef } from 'react';
import { useConversationStore } from '../lib/conversationStore';
import { EnhancedMarkdown } from './EnhancedMarkdown';
import { cleanMarkdownFormatting } from '../lib/markdownFormatter';
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
  // Ajout d'un nouvel état pour suivre si le streaming a commencé
  const [hasStarted, setHasStarted] = useState(false);
  const markMessageAsStreamed = useConversationStore(state => state.markMessageAsStreamed);
  const contentRef = useRef(content);
  const streamingIdRef = useRef(messageId);
  
  useEffect(() => {
    // If message ID changes, reset everything
    if (messageId !== streamingIdRef.current) {
      setDisplayedContent('');
      setIsComplete(false);
      setHasStarted(false);
      contentRef.current = content;
      streamingIdRef.current = messageId;
    }
    
    if (!content) return;
    
    // Nettoyer le contenu avant de streamer
    const cleanedContent = cleanMarkdownFormatting(content);
    
    let isMounted = true;
    let index = 0;
    const characters = cleanedContent.split('');
    
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
      let chunkSize = 0;
      const maxChunkSize = 15; // Ajuster pour contrôler la taille des chunks
      
      while (index < characters.length && !shouldPause && chunkSize < maxChunkSize) {
        currentChar = characters[index];
        const nextChars = characters.slice(index, index + 3).join('');
        const prevChar = index > 0 ? characters[index - 1] : '';
        
        // Handle Markdown syntax
        if (nextChars === '```') {
          markdownState.codeBlock = !markdownState.codeBlock;
          chunk += nextChars;
          index += 3;
          shouldPause = true;
          chunkSize += 3;
        } else if (nextChars.startsWith('**')) {
          markdownState.bold = !markdownState.bold;
          chunk += '**';
          index += 2;
          chunkSize += 2;
        } else if (currentChar === '`' && !markdownState.codeBlock) {
          markdownState.inlineCode = !markdownState.inlineCode;
          chunk += currentChar;
          index++;
          chunkSize++;
        } else if (currentChar === '*' && !markdownState.bold && prevChar !== '*') {
          markdownState.italic = !markdownState.italic;
          chunk += currentChar;
          index++;
          chunkSize++;
        } else if (currentChar === '[' && !markdownState.link) {
          markdownState.link = true;
          chunk += currentChar;
          index++;
          chunkSize++;
        } else if (currentChar === ']' && markdownState.link) {
          // Capture the entire link syntax
          const linkEnd = content.indexOf(')', index);
          if (linkEnd > -1) {
            chunk += content.slice(index, linkEnd + 1);
            index = linkEnd + 1;
            chunkSize += (linkEnd + 1 - index);
          } else {
            chunk += currentChar;
            index++;
            chunkSize++;
          }
          markdownState.link = false;
        } else if (currentChar === '#' && (prevChar === '\n' || index === 0)) {
          // Capture entire heading
          const headingEnd = content.indexOf('\n', index);
          if (headingEnd > -1) {
            chunk += content.slice(index, headingEnd + 1);
            index = headingEnd + 1;
            chunkSize += (headingEnd + 1 - index);
          } else {
            chunk += content.slice(index);
            index = characters.length;
            chunkSize += (characters.length - index);
          }
          shouldPause = true;
        } else if (currentChar === '-' && (prevChar === '\n' || index === 0)) {
          // Capture entire list item
          const itemEnd = content.indexOf('\n', index);
          if (itemEnd > -1) {
            chunk += content.slice(index, itemEnd + 1);
            index = itemEnd + 1;
            chunkSize += (itemEnd + 1 - index);
          } else {
            chunk += content.slice(index);
            index = characters.length;
            chunkSize += (characters.length - index);
          }
          shouldPause = true;
        } else if (currentChar === '>' && (prevChar === '\n' || index === 0)) {
          // Capture entire blockquote line
          const quoteEnd = content.indexOf('\n', index);
          if (quoteEnd > -1) {
            chunk += content.slice(index, quoteEnd + 1);
            index = quoteEnd + 1;
            chunkSize += (quoteEnd + 1 - index);
          } else {
            chunk += content.slice(index);
            index = characters.length;
            chunkSize += (characters.length - index);
          }
          shouldPause = true;
        } else if (currentChar === '.' || currentChar === '!' || currentChar === '?') {
          // Amélioration des pauses naturelles
          shouldPause = true;
          chunk += currentChar;
          index++;
          chunkSize++;
          
          // Capturer les espaces après la ponctuation
          while (index < characters.length && characters[index] === ' ') {
            chunk += characters[index];
            index++;
            chunkSize++;
          }
        } else if (currentChar === ',' || currentChar === ';' || currentChar === ':') {
          shouldPause = Math.random() > 0.25; // 75% de chance de pause
          chunk += currentChar;
          index++;
          chunkSize++;
        } else if (currentChar === '\n' || currentChar === '\r') {
          // Gestion des sauts de ligne
          shouldPause = true;
          chunk += currentChar;
          index++;
          chunkSize++;
          
          // Capturer les sauts de ligne consécutifs
          while (index < characters.length && (characters[index] === '\n' || characters[index] === '\r')) {
            chunk += characters[index];
            index++;
            chunkSize++;
          }
        } else if (currentChar === ' ') {
          // Capturer des mots entiers pour plus de fluidité
          chunk += currentChar;
          index++;
          chunkSize++;
          
          // Essayer de capturer le mot suivant en entier
          let wordBuffer = '';
          let wordStart = index;
          while (index < characters.length && 
                characters[index] !== ' ' && 
                !'.!?,;:)(\n\r'.includes(characters[index]) &&
                chunkSize < maxChunkSize) {
            wordBuffer += characters[index];
            index++;
            chunkSize++;
          }
          
          // Ajouter le mot au chunk
          chunk += wordBuffer;
          
          // Si on a capturé un mot complet, considérer une pause
          if (wordBuffer.length >= 5) {
            shouldPause = Math.random() > 0.6; // 40% de chance de pause après un mot long
          }
        } else {
          // Regular character processing
          chunk += currentChar;
          index++;
          chunkSize++;
          
          // Ensure we don't break in the middle of a word
          if (chunkSize >= maxChunkSize) { // Changed from targetSize to maxChunkSize
            // Look ahead to find word boundary
            let lookAhead = index;
            let foundBoundary = false;
            
            // Check if we're in the middle of a word
            if (index < characters.length && /[a-zA-ZÀ-ÿ0-9_\-]/.test(characters[index])) {
              // We're in the middle of a word, continue until we find a boundary
              while (lookAhead < characters.length && lookAhead < index + 20) {
                const nextChar = characters[lookAhead];
                if (!/[a-zA-ZÀ-ÿ0-9_\-]/.test(nextChar)) {
                  // Found word boundary
                  foundBoundary = true;
                  break;
                }
                lookAhead++;
              }
              
              if (foundBoundary && lookAhead - index < 20) {
                // Complete the word
                while (index < lookAhead) {
                  chunk += characters[index];
                  index++;
                  chunkSize++;
                }
              }
            }
            shouldPause = true;
          }
        }
        
        // Natural pauses
        if (!shouldPause) {
          // Pause at punctuation for natural flow
          if ('.!?:;,'.includes(currentChar)) {
            shouldPause = true;
          }
          // Pause after newlines
          else if (currentChar === '\n') {
            shouldPause = true;
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
        // Marquer que le streaming a commencé dès que nous avons le premier morceau
        setHasStarted(true);
        setDisplayedContent(prev => prev + chunk);
      }
      
      // Délais plus courts et plus naturels (valeurs en ms)
      const baseSpeed = speed * 0.8; // Légèrement plus rapide que l'original
      let delay = baseSpeed;
      
      if (shouldPause) {
        if (currentChar === '.' || currentChar === '!' || currentChar === '?') {
          delay = 240; // Plus court que 300ms
        } else if (currentChar === ',' || currentChar === ';') {
          delay = 120; // Plus court que 150ms
        } else {
          delay = 30; // Plus court que 50ms
        }
      }
      
      // Ajouter une légère variation aléatoire pour plus de naturel
      delay += Math.random() * 20 - 10; // +/- 10ms
      
      setTimeout(processNextChunk, delay);
    };
    
    // Réduire le délai initial à 800ms pour commencer plus rapidement
    setTimeout(processNextChunk, 800);
    
    return () => {
      isMounted = false;
    };
  }, [content, messageId, speed, markMessageAsStreamed, onStreamingComplete]);
  
  return (
    <div className="streaming-text-container">
      {isComplete ? (
        <EnhancedMarkdown content={cleanMarkdownFormatting(content)} />
      ) : (
        <div className="streaming-text">
          {!hasStarted && (
            // L'animation s'affiche en haut du conteneur tant que le streaming n'a pas commencé
            <div className="thinking-loader-wrapper">
              <div className="thinking-loader-circle"></div>
              <div className="thinking-loader-circle"></div>
              <div className="thinking-loader-circle"></div>
              <div className="thinking-loader-shadow"></div>
              <div className="thinking-loader-shadow"></div>
              <div className="thinking-loader-shadow"></div>
            </div>
          )}
          {/* Le contenu s'affiche progressivement dans le même conteneur */}
          {hasStarted && <EnhancedMarkdown content={displayedContent} />}
        </div>
      )}
    </div>
  );
};