'use client';

import React, { useState } from 'react';
import type { Plan } from '@/types';
import { ChevronDown, ChevronRight, CheckCircle2, Circle, Loader2, SkipForward } from 'lucide-react';

interface PlanTrackerProps {
  plan: Plan;
}

const statusIcons = {
  pending: Circle,
  in_progress: Loader2,
  completed: CheckCircle2,
  skipped: SkipForward,
};

const statusColors = {
  pending: 'text-slate-300',
  in_progress: 'text-primary animate-spin',
  completed: 'text-success',
  skipped: 'text-slate-200',
};

export function PlanTracker({ plan }: PlanTrackerProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const completedSteps = plan.steps.filter(s => s.status === 'completed').length;
  const totalSteps = plan.steps.length;

  return (
    <div className="border-t border-border bg-secondary/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-text-muted hover:bg-hover transition-colors"
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="font-medium text-foreground">Plan</span>
        <span className="text-xs text-text-muted">({completedSteps}/{totalSteps})</span>
        <span className="text-xs text-text-muted ml-auto truncate max-w-[120px]">{plan.goal}</span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 space-y-1">
          {plan.steps.map((step) => {
            const Icon = statusIcons[step.status];
            return (
              <div key={step.step_index} className="flex items-center gap-2 text-sm">
                <Icon size={14} className={statusColors[step.status]} />
                <span className={`text-xs font-medium ${step.status === 'skipped' ? 'line-through text-slate-300' : 'text-foreground'}`}>
                  {step.skill_id}
                </span>
                <span className="text-xs text-text-muted">{step.description}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
