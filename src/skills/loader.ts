import matter from 'gray-matter';
import type { SkillMeta, SkillDefinition } from '@/types';
import { LIMITS } from '../../config/limits';

export function parseSkillFile(content: string, fileName: string): SkillDefinition {
  const { data: frontmatter, content: prompt } = matter(content);

  const skillId = frontmatter.name || fileName.replace(/\.md$/, '');

  const meta: SkillMeta = {
    skill_id: skillId,
    description: frontmatter.description || '',
    tools: frontmatter.tools || [],
    requires: frontmatter.requires || [],
    budget: {
      context_tokens: frontmatter.budget?.context_tokens ?? 500,
      history_turns: frontmatter.budget?.history_turns ?? 4,
    },
    signals_schema: {},
  };

  // Parse signals schema from frontmatter
  if (frontmatter.signals) {
    if (Array.isArray(frontmatter.signals)) {
      for (const sig of frontmatter.signals) {
        if (typeof sig === 'string') {
          // Simple format: "field_name: type"
          const [name, type] = sig.split(':').map((s: string) => s.trim());
          if (name && type) {
            const enumMatch = type.match(/^enum\((.+)\)$/);
            meta.signals_schema[name] = {
              type: enumMatch ? 'enum' : type,
              values: enumMatch ? enumMatch[1].split(',').map((v: string) => v.trim()) : undefined,
              required: true,
            };
          }
        } else if (typeof sig === 'object') {
          const name = Object.keys(sig)[0];
          meta.signals_schema[name] = {
            type: typeof sig[name] === 'string' ? sig[name] : 'string',
            required: true,
          };
        }
      }
    }
  }

  // Validate instruction length
  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length > LIMITS.MAX_SKILL_INSTRUCTION_CHARS) {
    console.warn(`[SkillLoader] Skill "${skillId}" instruction exceeds ${LIMITS.MAX_SKILL_INSTRUCTION_CHARS} chars, truncating`);
  }

  return {
    meta,
    prompt: trimmedPrompt.slice(0, LIMITS.MAX_SKILL_INSTRUCTION_CHARS),
  };
}

// This will be populated after builtin skills are created
// For now, create the structure that imports raw skill content

export function loadBuiltinSkills(skillContents: Record<string, string>): Map<string, SkillDefinition> {
  const skills = new Map<string, SkillDefinition>();

  for (const [fileName, content] of Object.entries(skillContents)) {
    try {
      const skill = parseSkillFile(content, fileName);
      skills.set(skill.meta.skill_id, skill);
    } catch (error) {
      console.error(`[SkillLoader] Failed to parse ${fileName}:`, error);
    }
  }

  return skills;
}
