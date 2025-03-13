import { useState, useEffect } from 'react';

export function useMessageAnimation() {
  const [animationReady, setAnimationReady] = useState(false);
  
  useEffect(() => {
    // Allow page to load first
    const timer = setTimeout(() => {
      setAnimationReady(true);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);
  
  const getAnimationStyle = (index: number) => {
    if (!animationReady) return {};
    
    return {
      opacity: 0,
      transform: 'translateY(10px)',
      animation: `message-appear 0.3s ease forwards ${index * 0.1}s`
    };
  };
  
  return { getAnimationStyle };
}