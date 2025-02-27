import React, { useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ThinkingDots } from './ThinkingDots';
import { Message } from '../lib/types';
import { RingoLogo } from './RingoLogo';

interface ConversationProps {
  messages: Message[];
  isLoading: boolean;
}

export const Conversation: React.FC<ConversationProps> = ({ messages, isLoading }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change or when loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 bg-white overflow-y-auto p-4">
      <div className="max-w-4xl mx-auto">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <h2 className="text-2xl font-bold text-[#2F4F4F] mb-4">
              Allo, moi c'est <strong>Ringo</strong> ! Envie de mettre du rythme dans l'analyse ?!
            </h2>
            <p className="text-gray-600 max-w-md">
              Commencez par <strong>sélectionner</strong> votre ou vos fichiers en cliquant sur le bouton de la Base de données visuelle en bas à gauche du chat. Puis posez moi vos questions, j'analyserai le contenu et je vous répondrai avec plaisir...
            </p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <ChatMessage 
                key={message.id} 
                message={message} 
                isLast={index === messages.length - 1}
                isTyping={isLoading && index === messages.length - 1}
              />
            ))}
            
            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="bg-transparent text-[#2F4F4F] p-4 max-w-[80%]">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <RingoLogo size={24} className="text-[#2F4F4F]" />
                    </div>
                    <div>
                      <div className="font-medium mb-1">
                        Ringo
                      </div>
                      <ThinkingDots color="#2F4F4F" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};