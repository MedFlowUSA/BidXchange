import { test, expect } from '@playwright/test';
import { pursuitNextStep } from '../apps/web/components/pursuit-next-step';
import { workflowData, pursuit, user } from './fixtures/workflow-data';

test('primary action prioritizes cited stale evidence then register and respects a current no-bid', () => {
  const data = workflowData();
  data.decisionContext = 'current';
  data.requirements = [
    {
      id: 'requirement',
      pursuit_id: pursuit,
      requirement: 'GL',
      citation: 'Section 2',
      status: 'needs_review',
      owner_user_id: user,
      updated_at: data.reviewAsOf,
    },
  ];
  data.facts = [
    {
      id: 'policy',
      fact_type: 'insurance',
      label: 'General liability',
      value: 'Sample',
      verification_status: 'verified',
      verified_by: user,
      verified_at: data.reviewAsOf,
      source_reference: 'Sample',
      source_note: null,
      expiration_date: '2020-01-01',
      updated_at: data.reviewAsOf,
    },
  ];
  data.evidenceReviews = [
    {
      id: 'link',
      requirement_id: 'requirement',
      fact_id: 'policy',
      applicability: 'applicable',
      proposal_use: 'approved',
      approval_current: false,
      reason: 'Sample',
      reviewed_by: user,
      reviewed_at: data.reviewAsOf,
    },
  ];
  expect(pursuitNextStep(data, pursuit).title).toBe('Update General liability');
  data.facts[0].expiration_date = '2030-01-01';
  expect(pursuitNextStep(data, pursuit).title).toBe('Review remaining requirements (1 left)');
  data.registerSignoffs = [
    {
      id: 'signoff',
      context_token: 'current',
      note: 'Reviewed',
      signed_off_by: user,
      signed_off_at: data.reviewAsOf,
      requirement_count: 1,
      blocker_count: 0,
      clarification_count: 0,
    },
  ];
  data.decisions = [];
  expect(pursuitNextStep(data, pursuit).title).toBe('Record bid or no-bid');
  data.decisions = [
    {
      id: 'decision',
      decision: 'no_bid',
      reason: 'Pass',
      conditions: '',
      context_token: 'current',
      decided_by: user,
      decided_at: data.reviewAsOf,
    },
  ];
  expect(pursuitNextStep(data, pursuit).title).toBe('Review recorded no-bid decision');
  data.decisions[0].decision = 'bid';
  expect(pursuitNextStep(data, pursuit).title).toBe('Open submission handoff');
});
