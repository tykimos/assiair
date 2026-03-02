'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useWidget } from '@/widget/widget-provider';
import { ChatMessageComponent } from './chat-message';
import { Send } from 'lucide-react';

export function ChatView() {
  const { messages, isStreaming, sendMessage } = useWidget();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim());
    setInput('');
    inputRef.current?.focus();
  };

  const handleButtonClick = (label: string) => {
    if (isStreaming) return;
    sendMessage(label);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-sm:px-3 max-sm:py-3 max-sm:space-y-2">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div
                className="w-10 h-10 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-sm text-text-muted">Ask me anything</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessageComponent
            key={msg.id}
            message={msg}
            isLast={i === messages.length - 1}
            onButtonClick={handleButtonClick}
          />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-border bg-background px-3 py-3 max-sm:px-2 max-sm:py-2">
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            disabled={isStreaming}
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-border bg-card-bg text-foreground placeholder-text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50 transition-all"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
