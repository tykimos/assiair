import yaml from 'js-yaml';
import type { WorkflowDefinition } from '@/types';

// Import builtin workflow contents as raw strings
import greetingWorkflow from './builtin/greeting.yaml?raw';
import codeReviewAndFixWorkflow from './builtin/code-review-and-fix.yaml?raw';
import explainAndImproveWorkflow from './builtin/explain-and-improve.yaml?raw';
import eventQaWorkflow from './builtin/event-qa.yaml?raw';
import documentRequestWorkflow from './builtin/document-request.yaml?raw';

const BUILTIN_WORKFLOWS: Record<string, string> = {
  'greeting.yaml': greetingWorkflow,
  'code-review-and-fix.yaml': codeReviewAndFixWorkflow,
  'explain-and-improve.yaml': explainAndImproveWorkflow,
  'event-qa.yaml': eventQaWorkflow,
  'document-request.yaml': documentRequestWorkflow,
};

export function parseWorkflowFile(content: string): WorkflowDefinition {
  const parsed = yaml.load(content) as Record<string, unknown>;

  const workflow: WorkflowDefinition = {
    name: (parsed.name as string) || '',
    description: (parsed.description as string) || '',
    trigger_patterns: (parsed.trigger_patterns as string[]) || [],
    steps: ((parsed.steps as Array<Record<string, unknown>>) || []).map(step => ({
      skill_id: (step.skill_id as string) || '',
      description: (step.description as string) || '',
      required: (step.required as boolean) ?? true,
      condition: step.condition as string | undefined,
      inputs: step.inputs as string[] | undefined,
      outputs: step.outputs as string[] | undefined,
    })),
    steps_natural: parsed.steps_natural as string | undefined,
    completion_message: parsed.completion_message as string | undefined,
    max_chain_depth: (parsed.max_chain_depth as number) ?? 5,
  };

  return workflow;
}

export function loadBuiltinWorkflows(): WorkflowDefinition[] {
  const workflows: WorkflowDefinition[] = [];

  for (const [fileName, content] of Object.entries(BUILTIN_WORKFLOWS)) {
    try {
      const workflow = parseWorkflowFile(content);
      workflows.push(workflow);
    } catch (error) {
      console.error(`[WorkflowLoader] Failed to parse ${fileName}:`, error);
    }
  }

  return workflows;
}
