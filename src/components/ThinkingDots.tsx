import React, { useState, useEffect } from 'react';

interface ThinkingDotsProps {
  color?: string;
}

export const ThinkingDots: React.FC<ThinkingDotsProps> = ({ color = '#2F4F4F' }) => {
  const [dots, setDots] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev < 3 ? prev + 1 : 1);
    }, 400);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center space-x-2">
      {[1, 2, 3].map(i => (
        <div 
          key={i}
          className={`h-2 w-2 rounded-full transition-all duration-300 ease-in-out ${
            i <= dots ? 'opacity-100 scale-100' : 'opacity-30 scale-75'
          }`}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
};