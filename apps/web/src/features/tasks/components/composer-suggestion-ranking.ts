import type { SkillCatalogItem } from '../../../types/api';

export function matchingSkills(skills: readonly SkillCatalogItem[], rawQuery: string): SkillCatalogItem[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [...skills];

  return skills
    .map((skill) => ({ skill, priority: skillMatchPriority(skill, query) }))
    .filter((entry) => entry.priority < NO_MATCH)
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        left.skill.name.length - right.skill.name.length ||
        left.skill.name.localeCompare(right.skill.name)
    )
    .map((entry) => entry.skill);
}

const NO_MATCH = 5;

function skillMatchPriority(skill: SkillCatalogItem, query: string): number {
  const name = skill.name.toLowerCase();
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.split(/[-_.]/).some((segment) => segment.startsWith(query))) return 2;
  if (name.includes(query)) return 3;
  if (skill.description.toLowerCase().includes(query)) return 4;
  return NO_MATCH;
}
