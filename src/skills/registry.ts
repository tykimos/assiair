import type { SkillMeta, SkillDefinition } from '@/types';
import { loadBuiltinSkills } from './loader';

// Import builtin skill contents as raw strings
// These will be created in T2.4
import greetingSkill from './builtin/greeting.md';
import intentClarifySkill from './builtin/intent-clarify.md';
import codeReviewSkill from './builtin/code-review.md';
import codeFixSkill from './builtin/code-fix.md';
import testWriterSkill from './builtin/test-writer.md';
import explainCodeSkill from './builtin/explain-code.md';
import refactorSkill from './builtin/refactor.md';
import eventQaSkill from './builtin/event-qa.md';
import documentRequestSkill from './builtin/document-request.md';
import userLookupSkill from './builtin/user-lookup.md';

const BUILTIN_SKILLS: Record<string, string> = {
  'greeting.md': greetingSkill,
  'intent-clarify.md': intentClarifySkill,
  'code-review.md': codeReviewSkill,
  'code-fix.md': codeFixSkill,
  'test-writer.md': testWriterSkill,
  'explain-code.md': explainCodeSkill,
  'refactor.md': refactorSkill,
  'event-qa.md': eventQaSkill,
  'document-request.md': documentRequestSkill,
  'user-lookup.md': userLookupSkill,
};

export class SkillRegistryManager {
  private skills: Map<string, SkillDefinition>;
  private builtinOriginals: Map<string, SkillDefinition>;
  private activeSkills: Set<string>;
  private builtinIds: Set<string>;

  constructor() {
    this.skills = new Map();
    this.builtinOriginals = new Map();
    this.activeSkills = new Set();
    this.builtinIds = new Set();
  }

  initialize(): void {
    this.skills = loadBuiltinSkills(BUILTIN_SKILLS);
    // Store originals and mark as builtin
    for (const [skillId, def] of this.skills.entries()) {
      this.builtinOriginals.set(skillId, { meta: { ...def.meta }, prompt: def.prompt });
      this.activeSkills.add(skillId);
      this.builtinIds.add(skillId);
    }
  }

  /** Get the original builtin definition (before any user overrides) */
  getBuiltinOriginal(skillId: string): SkillDefinition | undefined {
    return this.builtinOriginals.get(skillId);
  }

  getSkill(skillId: string): SkillDefinition | undefined {
    return this.skills.get(skillId);
  }

  getAllSkillMetas(): SkillMeta[] {
    return Array.from(this.skills.values())
      .filter(s => this.activeSkills.has(s.meta.skill_id))
      .map(s => s.meta);
  }

  getSkillPrompt(skillId: string): string | undefined {
    return this.skills.get(skillId)?.prompt;
  }

  getSkillTools(skillId: string): string[] {
    return this.skills.get(skillId)?.meta.tools || [];
  }

  registerSkill(skillId: string, definition: SkillDefinition): void {
    this.skills.set(skillId, definition);
    this.activeSkills.add(skillId);
  }

  isSkillActive(skillId: string): boolean {
    return this.activeSkills.has(skillId);
  }

  setSkillActive(skillId: string, active: boolean): void {
    if (active) {
      this.activeSkills.add(skillId);
    } else {
      this.activeSkills.delete(skillId);
    }
  }

  getSkillCount(): number {
    return this.skills.size;
  }

  getActiveSkillIds(): string[] {
    return Array.from(this.activeSkills);
  }

  getAllSkillDefinitions(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  removeSkill(skillId: string): boolean {
    if (this.builtinIds.has(skillId)) return false;
    this.skills.delete(skillId);
    this.activeSkills.delete(skillId);
    return true;
  }

  isBuiltin(skillId: string): boolean {
    return this.builtinIds.has(skillId);
  }
}

// Singleton instance
let registryInstance: SkillRegistryManager | null = null;

export function getSkillRegistry(): SkillRegistryManager {
  if (!registryInstance) {
    registryInstance = new SkillRegistryManager();
    registryInstance.initialize();
  }
  return registryInstance;
}
