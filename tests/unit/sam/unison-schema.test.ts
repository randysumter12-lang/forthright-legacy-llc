import { describe, expect, it } from 'vitest';
import {
  SamOpportunityItemUnion,
  SamOpportunityItemUnison,
} from '../../../src/lib/contracts/sam-opportunity';
import fixture1 from '../../fixtures/unison/one.json';
import fixture3 from '../../fixtures/unison/three.json';
import fixture2 from '../../fixtures/unison/two.json';

const cases = {
  'one.json': fixture1,
  'two.json': fixture2,
  'three.json': fixture3,
} as const;

describe('UNISON contract — discriminated union', () => {
  for (const [name, raw] of Object.entries(cases)) {
    it(`round-trips ${name} through SamOpportunityItemUnison.parse`, () => {
      const parsed = SamOpportunityItemUnison.parse(raw);
      expect(parsed.source).toBe('UNISON');
      expect(parsed.unisonBuyId?.length).toBeGreaterThan(0);
      expect(parsed.unisonRevision).toBeTypeOf('number');
    });
    it(`${name} classifies under SamOpportunityItemUnion`, () => {
      expect(() => SamOpportunityItemUnion.parse(raw)).not.toThrow();
    });
  }
});

describe('fixture three carries the cross-source dedupe key', () => {
  it('three.json solicitationNumber echoes the SAM canonical', () => {
    const parsed = SamOpportunityItemUnison.parse(fixture3);
    expect(parsed.solicitationNumber).toBe('36C10X-24-Q-0047');
  });
});
