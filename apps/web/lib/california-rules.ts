export const californiaRulesVersion = 'ca-field-contractors-2026-09-21.1';
export const requirementCategories = [
  'License',
  'Bond',
  'Insurance',
  'Registration',
  'Set-aside',
  'Site visit or pre-bid meeting',
  'Prevailing wage',
  'Certified payroll',
  'Past experience',
  'Key personnel',
  'Safety',
  'Forms',
  'Technical',
  'Submission',
  'Deadline',
  'Pricing format',
  'Amendment acknowledgment',
  'Other',
] as const;
const rules = [
  [
    'electrical',
    'License',
    /\b(electrical|lighting|EVSE|EV charging)\b/i,
    'Review the stated CSLB classification and scope; electrical keywords do not establish license coverage.',
  ],
  [
    'construction',
    'License',
    /\b(general construction|HVAC)\b/i,
    'Compare the exact work with the stated classification and obtain a human licensing review.',
  ],
  [
    'public-works',
    'Registration',
    /\b(public works|DIR|PWCR)\b/i,
    'Check whether the notice requires DIR registration and record current evidence.',
  ],
  [
    'wage',
    'Prevailing wage',
    /prevailing[ -]wage/i,
    'Review the applicable wage determination, classifications and notice conditions.',
  ],
  [
    'payroll',
    'Certified payroll',
    /certified[ -]payroll/i,
    'Confirm the required payroll process, responsibility and reporting instructions.',
  ],
  [
    'bid-bond',
    'Bond',
    /bid[ -]bond/i,
    'Confirm bid-bond amount, form and deadline with the surety.',
  ],
  [
    'performance-bond',
    'Bond',
    /(payment|performance)[ -]bond/i,
    'Review payment/performance bond terms and confirmed capacity.',
  ],
  [
    'meeting',
    'Site visit or pre-bid meeting',
    /(mandatory.*(job walk|site visit|pre[ -]bid)|(job walk|site visit|pre[ -]bid).*mandatory)/i,
    'Confirm attendance requirements, date, location and any exception with the buyer.',
  ],
  [
    'sb-dvbe',
    'Set-aside',
    /\b(SB\/DVBE|DVBE|small business preference)\b/i,
    'Review certification or preference conditions; keywords do not establish entitlement.',
  ],
  [
    'diversity',
    'Registration',
    /supplier diversity/i,
    'Review the buyer’s supplier-diversity program and evidence requirements.',
  ],
  [
    'utility',
    'Registration',
    /\b(SCE|LADWP|SoCalGas|SDG&E)\b/i,
    'Check buyer registration, supplier-diversity and portal instructions; add evidence only when required.',
  ],
  [
    'insurance',
    'Insurance',
    /\b(insurance|general liability|workers.? compensation)\b/i,
    'Compare coverage, endorsements, exclusions and expiration with the notice.',
  ],
  [
    'addenda',
    'Amendment acknowledgment',
    /\b(addend[au]|amendment acknowledgment)\b/i,
    'Confirm the current addenda and required acknowledgment.',
  ],
] as const;
export function californiaSuggestions(text: string) {
  if (text.length > 24000) throw new Error('Use an excerpt of at most 24,000 characters.');
  return text
    .split(/\r?\n/)
    .flatMap((quote, index) =>
      rules
        .filter(([, , pattern]) => pattern.test(quote))
        .map(([id, category, , explanation]) => ({
          id: `${id}:${index + 1}`,
          rule: id,
          version: californiaRulesVersion,
          category,
          quote: quote.slice(0, 1200),
          line: index + 1,
          explanation,
          confidence: 'low' as const,
          mandatoryCandidate: /\b(must|shall|required|mandatory)\b/i.test(quote),
        })),
    )
    .slice(0, 40);
}
