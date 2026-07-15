import { describe, expect, it } from 'vitest';
import type { SkillCatalogItem } from '../../../types/api';
import { matchingSkills } from './composer-suggestion-ranking';

function skill(name: string, description = ''): SkillCatalogItem {
  return { name, description, command: `/${name}`, enabled: true, sources: [] };
}

describe('Skill suggestion ranking', () => {
  it('prioritizes exact and prefix matches over name and description matches', () => {
    const items = [
      skill('artifact-template-design-report'),
      skill('pdf', 'Create a polished report'),
      skill('report-master'),
      skill('report'),
    ];

    expect(matchingSkills(items, 'report').map((item) => item.name)).toEqual([
      'report',
      'report-master',
      'artifact-template-design-report',
      'pdf',
    ]);
  });

  it('returns no unrelated Skills', () => {
    expect(matchingSkills([skill('reviewer'), skill('report-master')], 'deploy')).toEqual([]);
  });
});
