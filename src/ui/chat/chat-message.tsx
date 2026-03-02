'use client';

import React, { useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '@/types';
import { PromptButtons } from './prompt-buttons';

/** Strip XML control tags (<signals>, <prompt_buttons>, <post_orch>) and any partial opening tags at the end */
function stripInternalTags(text: string): string {
  return text
    .replace(/<signals>[\s\S]*?<\/signals>/g, '')
    .replace(/<prompt_buttons>[\s\S]*?<\/prompt_buttons>/g, '')
    .replace(/<post_orch>[\s\S]*?<\/post_orch>/g, '')
    .replace(/<(?:signals|prompt_buttons|post_orch)[^>]*$/g, '')  // partial opening tag at end
    .replace(/<\/(?:signals|prompt_buttons|post_orch)>\s*$/g, '') // leftover closing
    .trim();
}

interface ChatMessageProps {
  message: ChatMessage;
  isLast: boolean;
  onButtonClick: (label: string) => void;
}

/** Inline PDF download button — rendered when a markdown link points to a data:application/pdf URL */
function PdfDownloadButton({ href, filename }: { href: string; filename: string }) {
  const handleClick = useCallback(() => {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [href, filename]);

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-2 px-4 py-2.5 my-2 rounded-xl border border-border bg-slate-50 hover:bg-slate-100 hover:border-primary transition-all shadow-sm cursor-pointer"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 flex-shrink-0">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <polyline points="9 15 12 18 15 15" />
      </svg>
      <span className="text-sm font-medium text-slate-700">{filename}</span>
    </button>
  );
}

/** Custom ReactMarkdown components: renders PDF links as download buttons, QR images inline */
const markdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  img: ({ src, alt }) => {
    if (src) {
      return (
        <img
          src={src}
          alt={alt || ''}
          className="inline-block my-2 rounded-lg"
          style={{ maxWidth: '200px', height: 'auto' }}
        />
      );
    }
    return null;
  },
  a: ({ href, children }) => {
    const isPdf = href && (
      href.startsWith('data:application/pdf') ||
      href.startsWith('/api/pdf') ||
      href.includes('/api/pdf')
    );
    if (isPdf) {
      const label = typeof children === 'string' ? children : String(children ?? 'document.pdf');
      const filename = label.endsWith('.pdf') ? label : `${label}.pdf`;
      return <PdfDownloadButton href={href} filename={filename} />;
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
};

// Spinning gradient circle for orchestrator "thinking" state
function SpinningGradientCircle() {
  return (
    <div className="relative w-4 h-4 flex-shrink-0">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'conic-gradient(from 0deg, #a78bfa, #f472b6, #67e8f9, #a78bfa)',
          animation: 'spin-gradient 1s linear infinite',
        }}
      />
      {/* Filled gradient circle — no inner white circle */}
    </div>
  );
}

// Hook message — right-aligned small dashed pill
function HookMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="message-bubble flex justify-end">
      <div className="flex items-center gap-2 px-3 py-1.5 border border-dashed border-slate-300 rounded-lg">
        <span className="text-xs text-slate-500">{message.content}</span>
      </div>
    </div>
  );
}

// Orchestrator message — left-aligned dashed pill, thinking or done state
function OrchestratorMessage({ message }: { message: ChatMessage }) {
  const isThinking = !!message.thinking;

  return (
    <div className="message-bubble flex justify-start">
      {isThinking ? (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100">
          <SpinningGradientCircle />
          <span className="text-xs text-slate-500">{message.thinking}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-1.5 border border-dashed border-slate-300 rounded-lg">
          <span className="text-xs text-slate-500">{message.content}</span>
        </div>
      )}
    </div>
  );
}

// Building step row
function BuildingStepRow({ step, status, ok }: { step: string; status: 'pending' | 'running' | 'done'; ok?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {status === 'running' && (
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #67e8f9)',
            animation: 'spin-gradient 1s linear infinite',
          }}
        />
      )}
      {status === 'done' && ok !== false && (
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: '#10b981' }}
        />
      )}
      {status === 'done' && ok === false && (
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: '#f59e0b' }}
        />
      )}
      {status === 'pending' && (
        <div className="w-2 h-2 rounded-full flex-shrink-0 bg-slate-200" />
      )}
      <span
        className={`text-xs ${
          status === 'pending' ? 'text-slate-400' :
          status === 'running' ? 'text-slate-600' :
          ok === false ? 'text-amber-500' :
          'text-slate-500'
        }`}
      >
        {step}
      </span>
    </div>
  );
}

// Execution message — left-aligned, shows building steps then markdown content
function ExecutionMessage({ message, isLast, onButtonClick }: ChatMessageProps) {
  const displayContent = useMemo(() => stripInternalTags(message.content), [message.content]);
  const hasContent = displayContent.length > 0;
  const hasSteps = message.buildingSteps && message.buildingSteps.length > 0;

  return (
    <div className="message-bubble flex flex-col gap-2 items-start max-w-[85%] max-sm:max-w-[95%]">
      {/* Building steps — shown when building or alongside content */}
      {hasSteps && !hasContent && (
        <div className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-slate-50 border border-border">
          {message.buildingSteps!.map((bs, i) => (
            <BuildingStepRow key={i} step={bs.step} status={bs.status} ok={bs.ok} />
          ))}
        </div>
      )}

      {/* Streamed markdown content */}
      {hasContent && (
        <div className="bg-card-bg border border-border px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
          <div className="prose-chat max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {displayContent}
            </ReactMarkdown>
            {message.isStreaming && (
              <span
                className="inline-block w-1.5 h-4 ml-0.5 rounded-sm"
                style={{
                  background: 'var(--primary)',
                  animation: 'fadeIn 0.5s ease-in-out infinite alternate',
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Prompt buttons below bubble */}
      {!message.isStreaming && isLast && message.promptButtons && message.promptButtons.length > 0 && (
        <PromptButtons
          buttons={message.promptButtons}
          onButtonClick={onButtonClick}
        />
      )}
    </div>
  );
}

// User message — right-aligned indigo bubble
function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="message-bubble flex justify-end">
      <div
        className="max-w-[80%] max-sm:max-w-[90%] px-4 py-2.5 rounded-2xl rounded-br-sm text-white text-sm"
        style={{ background: 'var(--primary)' }}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}

export function ChatMessageComponent({ message, isLast, onButtonClick }: ChatMessageProps) {
  const msgType = message.messageType;

  if (msgType === 'hook') {
    return <HookMessage message={message} />;
  }

  if (msgType === 'orchestrator') {
    return <OrchestratorMessage message={message} />;
  }

  if (msgType === 'execution') {
    return <ExecutionMessage message={message} isLast={isLast} onButtonClick={onButtonClick} />;
  }

  // Default: user message or legacy messages
  if (message.role === 'user') {
    return <UserMessage message={message} />;
  }

  // Legacy assistant message fallback
  const legacyContent = stripInternalTags(message.content);
  return (
    <div className="message-bubble flex flex-col gap-2 items-start max-w-[85%] max-sm:max-w-[95%]">
      <div className="bg-card-bg border border-border px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
        <div className="prose-chat max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {legacyContent}
          </ReactMarkdown>
          {message.isStreaming && (
            <span
              className="inline-block w-1.5 h-4 ml-0.5 rounded-sm"
              style={{
                background: 'var(--primary)',
                animation: 'fadeIn 0.5s ease-in-out infinite alternate',
              }}
            />
          )}
        </div>
      </div>
      {!message.isStreaming && isLast && message.promptButtons && message.promptButtons.length > 0 && (
        <PromptButtons buttons={message.promptButtons} onButtonClick={onButtonClick} />
      )}
    </div>
  );
}
