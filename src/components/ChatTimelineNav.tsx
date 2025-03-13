import React, { useMemo } from 'react';
import { Message } from '../lib/conversationStore';

interface ChatTimelineNavProps {
  messages: Message[];
  onTimelineClick: (messageId: string) => void;
}

export const ChatTimelineNav: React.FC<ChatTimelineNavProps> = ({
  messages,
  onTimelineClick
}) => {
  // Group messages by day
  const messagesByDay = useMemo(() => {
    const groups: Record<string, Message[]> = {};
    
    messages.forEach(message => {
      const date = new Date(message.created_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    
    return groups;
  }, [messages]);
  
  return (
    <div className="timeline-nav">
      {Object.entries(messagesByDay).map(([date, msgs]) => (
        <div key={date} className="timeline-day">
          <div className="timeline-date">{date}</div>
          <div className="timeline-markers">
            {msgs.map((msg) => (
              <button
                key={msg.id}
                onClick={() => onTimelineClick(msg.id)}
                className={`timeline-marker ${msg.sender === 'assistant' ? 'marker-assistant' : 'marker-user'}`}
                title={new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};