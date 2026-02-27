import type { WorkflowDefinition } from '@/types';
import { loadBuiltinWorkflows } from './loader';

export class WorkflowRegistryManager {
  private workflows: Map<string, WorkflowDefinition>;
  private builtinOriginals: Map<string, WorkflowDefinition>;
  private builtinNames: Set<string>;
  private activeWorkflows: Set<string>;

  constructor() {
    this.workflows = new Map();
    this.builtinOriginals = new Map();
    this.builtinNames = new Set();
    this.activeWorkflows = new Set();
  }

  initialize(): void {
    const builtins = loadBuiltinWorkflows();
    for (const w of builtins) {
      this.workflows.set(w.name, w);
      this.builtinOriginals.set(w.name, { ...w, trigger_patterns: [...w.trigger_patterns], steps: [...w.steps] });
      this.builtinNames.add(w.name);
      this.activeWorkflows.add(w.name);
    }
  }

  getBuiltinOriginal(name: string): WorkflowDefinition | undefined {
    return this.builtinOriginals.get(name);
  }

  /** Returns only active workflows (used by orchestrator) */
  getAll(): WorkflowDefinition[] {
    return Array.from(this.workflows.values())
      .filter(w => this.activeWorkflows.has(w.name));
  }

  /** Returns all workflows regardless of active state (used by UI) */
  getAllDefinitions(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  get(name: string): WorkflowDefinition | undefined {
    return this.workflows.get(name);
  }

  register(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.name, workflow);
    this.activeWorkflows.add(workflow.name);
  }

  remove(name: string): boolean {
    if (this.builtinNames.has(name)) return false;
    this.activeWorkflows.delete(name);
    return this.workflows.delete(name);
  }

  isBuiltin(name: string): boolean {
    return this.builtinNames.has(name);
  }

  isActive(name: string): boolean {
    return this.activeWorkflows.has(name);
  }

  setActive(name: string, active: boolean): void {
    if (active) {
      this.activeWorkflows.add(name);
    } else {
      this.activeWorkflows.delete(name);
    }
  }

  getActiveNames(): string[] {
    return Array.from(this.activeWorkflows);
  }
}

// Singleton instance
let registryInstance: WorkflowRegistryManager | null = null;

export function getWorkflowRegistry(): WorkflowRegistryManager {
  if (!registryInstance) {
    registryInstance = new WorkflowRegistryManager();
    registryInstance.initialize();
  }
  return registryInstance;
}
