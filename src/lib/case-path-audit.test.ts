import { describe, expect, it } from 'vitest';
import { casePathAudit } from './case-path-audit';

describe('published path evidence belongs to the displayed asset', () => {
  it('returns atlas evidence only for an atlas model', () => {
    const report = casePathAudit('movement-types', 'tip', 'claude-atlas-v1');
    expect(report?.samples).toBeGreaterThan(0);
    expect(report?.pairs.length).toBeGreaterThan(0);
    expect(casePathAudit('movement-types', 'tip', undefined)).toBeNull();
    expect(casePathAudit('unknown', 'tip', 'claude-atlas-v1')).toBeNull();
  });
});
