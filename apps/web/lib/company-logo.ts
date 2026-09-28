import type { Fact } from './tenant-types';

// Facts have already passed tenant/role authorization. Branding does not attest qualifications.
// Restrict to deployed public PNG assets; never load a customer-supplied remote tracking URL.
export function companyLogo(facts: Fact[]): string | null {
  const logos = facts.filter(
    (fact) => fact.fact_type === 'identity' && fact.label.trim().toLowerCase() === 'company logo',
  );
  if (logos.length !== 1) return null;
  const path = logos[0].value?.trim() ?? '';
  return /^\/company-brand\/[a-z0-9][a-z0-9_-]{0,99}\.png$/.test(path) ? path : null;
}
