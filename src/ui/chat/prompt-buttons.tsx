'use client';

import React from 'react';

interface PromptButtonsProps {
  buttons: string[];
  onButtonClick: (label: string) => void;
  disabled?: boolean;
}

export function PromptButtons({ buttons, onButtonClick, disabled }: PromptButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {buttons.map((label, i) => (
        <button
          key={i}
          onClick={() => onButtonClick(label)}
          disabled={disabled}
          className="flex-shrink-0 px-3 py-1.5 text-xs rounded-full border border-border text-text-muted bg-card-bg hover:border-primary hover:text-primary hover:bg-secondary transition-all disabled:opacity-50 disabled:cursor-not-allowed animate-fade-in"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
