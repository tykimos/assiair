'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react';

interface ToolTraceProps {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export function ToolTrace({ toolName, args, result }: ToolTraceProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="text-xs border border-gray-200 dark:border-gray-700 rounded-md my-1">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Wrench size={12} />
        <span className="font-mono">{toolName}</span>
      </button>

      {isExpanded && (
        <div className="px-2 pb-2 space-y-1">
          <div>
            <span className="text-gray-400">Args:</span>
            <pre className="mt-0.5 p-1 bg-gray-50 dark:bg-gray-800 rounded text-xs overflow-x-auto">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>
          {result !== undefined && (
            <div>
              <span className="text-gray-400">Result:</span>
              <pre className="mt-0.5 p-1 bg-gray-50 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
