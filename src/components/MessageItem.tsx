import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message } from '../lib/conversationStore';
import { DirectStreamingText } from './DirectStreamingText';
import { useConversationStore } from '../lib/conversationStore';
import { EnhancedMarkdown } from './EnhancedMarkdown';
import { messageVariants, transition } from '../lib/animations';

interface MessageItemProps {
  message: Message;
  isLatestAssistantMessage: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({ 
  message, 
  isLatestAssistantMessage 
}) => {
  const isAssistant = message.sender === 'assistant';
  const streamedMessages = useConversationStore(state => state.streamedMessages);
  
  const shouldStream = isAssistant && isLatestAssistantMessage && !streamedMessages.has(message.id);
  
  const formattedTime = new Date(message.created_at).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  if (isAssistant) {
    return (
      <motion.div
        variants={messageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={transition}
        className="my-1.5 flex flex-col"
      >
        <div className="flex items-center gap-1 mb-0.5 px-3 text-xs text-gray-600">
          <span className="text-gray-400">{formattedTime}</span>
          <span>Assistant</span>
        </div>
        <motion.div 
          className="self-start mr-12 ml-3"
          layout
        >
          <div className="bg-gray-50 border border-gray-200 p-2 px-3 rounded-md shadow-sm">
            {shouldStream ? (
              <DirectStreamingText 
                content={message.content} 
                messageId={message.id}
                speed={4} 
              />
            ) : (
              <EnhancedMarkdown content={message.content} />
            )}
          </div>
        </motion.div>
      </motion.div>
    );
  }
  
  return (
    <motion.div
      variants={messageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transition}
      className="my-1.5 flex flex-col"
    >
      <div className="flex items-center gap-1 mb-0.5 px-3 text-xs text-gray-600">
        <span className="text-gray-400">{formattedTime}</span>
        <span>Vous</span>
      </div>
      <motion.div 
        className="self-end ml-12 mr-3"
        layout
      >
        <div className="bg-[#f15922] text-white p-2 px-3 rounded-md shadow-sm text-sm leading-relaxed">
          {message.content}
        </div>
      </motion.div>
    </motion.div>
  );
};