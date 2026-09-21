export type CompanyField = {
  key: string;
  label: string;
  format?: 'email' | 'amount' | 'date' | 'code';
  max?: number;
};
export type CompanyTemplate = {
  type: string;
  label: string;
  fields: CompanyField[];
  autofill?: string;
};
const field = (key: string, label: string, format?: CompanyField['format']): CompanyField => ({
  key,
  label,
  ...(format ? { format } : {}),
});

// Stable keys, independent of the editable evidence label. Unknown values stay blank.
export const companyTemplates: Record<string, CompanyTemplate> = {
  procurement_codes: {
    type: 'capability',
    label: 'Procurement classification codes',
    fields: [
      field('naics', 'NAICS codes'),
      field('psc', 'PSC codes'),
      field('nigp', 'NIGP codes'),
      field('unspsc', 'UNSPSC codes'),
      field('scope', 'Work supported by these codes'),
    ],
  },
  safety_record: {
    type: 'safety',
    label: 'Safety and EMR evidence',
    fields: [
      field('emr', 'EMR and rating period'),
      field('issuer', 'Rating issuer'),
      field('program', 'Safety program reference'),
      field('incidents', 'Disclosable incident history reference'),
      field('assessed', 'Assessment date', 'date'),
    ],
  },
  labor_compliance: {
    type: 'compliance',
    label: 'Labor and prevailing-wage capability',
    fields: [
      field('registration', 'Labor / public works registration'),
      field('prevailing_wage', 'Prevailing-wage capability and evidence'),
      field('payroll', 'Certified payroll process'),
      field('apprenticeship', 'Apprenticeship obligations'),
      field('limitations', 'Jurisdiction and limitations'),
    ],
  },
  financial_capacity: {
    type: 'financial',
    label: 'Reviewed financial capacity',
    fields: [
      field('capacity', 'Reviewed capacity', 'amount'),
      field('currency', 'Currency', 'code'),
      field('assessed', 'Assessment date', 'date'),
      field('reviewer', 'Review source'),
      field('conditions', 'Limitations; no bank details'),
    ],
  },
  staffing_capacity: {
    type: 'capacity',
    label: 'Staffing and scheduling capacity',
    fields: [
      field('employees', 'Employee count and roles'),
      field('backlog', 'Committed work / backlog'),
      field('available', 'Available from', 'date'),
      field('constraints', 'Capacity and scheduling constraints'),
    ],
  },
  partner_qualification: {
    type: 'subcontractor',
    label: 'Partner and subcontractor qualifications',
    fields: [
      field('entity', 'Partner legal entity'),
      field('scope', 'Proposed scope'),
      field('qualifications', 'License / certification references'),
      field('agreement', 'Teaming agreement reference'),
      field('permission', 'Permission to use partner evidence'),
    ],
  },
  reusable_documents: {
    type: 'compliance',
    label: 'Reusable forms and capability statement',
    fields: [
      field('capability_statement', 'Capability statement reference'),
      field('standard_forms', 'Standard form references'),
      field('reviewed', 'Last reviewed', 'date'),
      field('restrictions', 'Reuse restrictions'),
    ],
  },
  tax_reference: {
    type: 'financial',
    label: 'Tax identity evidence reference',
    fields: [
      field('reference', 'Secure EIN / W-9 document reference; do not enter full tax ID'),
      field('entity', 'Entity named on tax document'),
      field('reviewed', 'Last reviewed', 'date'),
    ],
  },
  mailing_address: {
    type: 'identity',
    label: 'Business mailing address',
    autofill: 'Company address',
    fields: [
      field('line1', 'Address line 1'),
      field('line2', 'Address line 2'),
      field('city', 'City'),
      field('region', 'State / province'),
      field('postal_code', 'Postal code'),
      field('country', 'Country'),
    ],
  },
  business_phone: {
    type: 'identity',
    label: 'Business phone',
    autofill: 'Business phone',
    fields: [field('number', 'Phone number'), field('extension', 'Extension')],
  },
  business_email: {
    type: 'identity',
    label: 'Business email',
    autofill: 'Business email',
    fields: [field('email', 'Business email address', 'email')],
  },
  representative: {
    type: 'identity',
    label: 'Authorized company representative',
    autofill: 'Company contact',
    fields: [
      field('name', 'Representative name'),
      field('title', 'Job title'),
      field('email', 'Work email', 'email'),
      field('phone', 'Work phone'),
      field('authority', 'Authority reference'),
    ],
  },
  entity: {
    type: 'identity',
    label: 'Legal business name',
    fields: [
      field('legal_name', 'Legal business name'),
      field('operating_name', 'Operating name / DBA'),
      field('entity_type', 'Entity type'),
      field('formation_jurisdiction', 'Formation jurisdiction'),
      field('established', 'Date established', 'date'),
    ],
  },
  registration: {
    type: 'registration',
    label: 'Registration',
    fields: [
      field('program', 'Registry / program'),
      field('identifier', 'Public registration identifier'),
      field('entity', 'Registered entity'),
      field('jurisdiction', 'Jurisdiction / buyer'),
      field('status', 'Recorded status'),
    ],
  },
  uei_cage: {
    type: 'registration',
    label: 'UEI and CAGE identifiers',
    fields: [field('uei', 'UEI'), field('cage', 'CAGE code'), field('entity', 'Registered entity')],
  },
  license: {
    type: 'license',
    label: 'License',
    fields: [
      field('number', 'License number'),
      field('issuer', 'Issuing authority'),
      field('classification', 'Classification'),
      field('jurisdiction', 'Jurisdiction'),
      field('holder', 'License holder'),
      field('status', 'Recorded status'),
    ],
  },
  certification: {
    type: 'certification',
    label: 'Certification',
    fields: [
      field('name', 'Certification name'),
      field('number', 'Certificate identifier'),
      field('issuer', 'Certifying body'),
      field('scope', 'Applicable scope'),
      field('status', 'Recorded status'),
    ],
  },
  insurance: {
    type: 'insurance',
    label: 'Insurance policy',
    fields: [
      field('carrier', 'Carrier'),
      field('type', 'Policy type'),
      field('number', 'Policy number'),
      field('occurrence_limit', 'Per-occurrence limit', 'amount'),
      field('aggregate_limit', 'Aggregate limit', 'amount'),
      field('currency', 'Currency', 'code'),
      field('endorsements', 'Endorsements'),
      field('exclusions', 'Exclusions'),
    ],
  },
  bonding: {
    type: 'bonding',
    label: 'Bonding capacity',
    fields: [
      field('surety', 'Surety'),
      field('single_limit', 'Single-project limit', 'amount'),
      field('aggregate_limit', 'Aggregate limit', 'amount'),
      field('committed', 'Committed capacity', 'amount'),
      field('remaining', 'Confirmed remaining capacity', 'amount'),
      field('currency', 'Currency', 'code'),
      field('assessed', 'Assessment date', 'date'),
      field('conditions', 'Conditions'),
    ],
  },
  project: {
    type: 'past_performance',
    label: 'Comparable project reference',
    fields: [
      field('name', 'Project name'),
      field('client', 'Client'),
      field('scope', 'Comparable scope'),
      field('role', 'Prime / subcontractor role'),
      field('start', 'Start date', 'date'),
      field('end', 'Completion date', 'date'),
      field('value', 'Contract value', 'amount'),
      field('currency', 'Currency', 'code'),
      field('outcome', 'Documented outcome'),
      field('reference', 'Reference contact and permission'),
    ],
  },
  personnel: {
    type: 'personnel',
    label: 'Key personnel qualifications',
    fields: [
      field('name', 'Person name'),
      field('role', 'Proposed role'),
      field('qualifications', 'Qualifications'),
      field('credentials', 'Professional credentials'),
      field('available', 'Available from', 'date'),
      field('resume', 'Resume reference'),
      field('permission', 'Proposal-use permission reference'),
    ],
  },
  equipment: {
    type: 'capacity',
    label: 'Equipment availability',
    fields: [
      field('name', 'Equipment / asset'),
      field('quantity', 'Quantity', 'amount'),
      field('ownership', 'Owned / leased / partner'),
      field('location', 'Operating location'),
      field('available', 'Available from', 'date'),
      field('limitations', 'Availability conditions'),
    ],
  },
};

export function suggestedTemplate(type: string, label: string) {
  const aliases: Record<string, string> = {
    'Primary contractor or professional license': 'license',
    'SAM registration': 'registration',
    'State and local vendor registrations': 'registration',
    'Business certifications': 'certification',
    'Insurance coverage and endorsements': 'insurance',
    'Single-project bonding limit': 'bonding',
    'Aggregate bonding capacity': 'bonding',
  };
  if (Object.hasOwn(aliases, label) && companyTemplates[aliases[label]].type === type)
    return aliases[label];
  return (
    Object.entries(companyTemplates).find(([, t]) => t.type === type && t.label === label)?.[0] ??
    ''
  );
}

export function structuredErrors(kind: string, fields: unknown): string[] {
  const template = companyTemplates[kind];
  if (
    !Object.hasOwn(companyTemplates, kind) ||
    !template ||
    !fields ||
    typeof fields !== 'object' ||
    Array.isArray(fields)
  )
    return ['Choose a supported structured record.'];
  const values = fields as Record<string, unknown>;
  const errors: string[] = [];
  if (Object.keys(values).some((key) => !template.fields.some((f) => f.key === key)))
    errors.push('Unsupported structured field.');
  for (const f of template.fields) {
    const value = values[f.key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length > (f.max ?? 500)) {
      errors.push(`${f.label}: use at most ${f.max ?? 500} characters.`);
      continue;
    }
    if (!value) continue;
    if (value !== value.trim()) errors.push(`${f.label}: remove surrounding spaces.`);
    if (f.format === 'amount' && !/^(0|[1-9]\d{0,12})(\.\d{1,2})?$/.test(value))
      errors.push(
        `${f.label}: enter a nonnegative number without commas, with up to two decimal places.`,
      );
    if (f.format === 'code' && !/^[A-Z]{3}$/.test(value))
      errors.push(`${f.label}: use a three-letter uppercase currency code.`);
    if (f.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      errors.push(`${f.label}: enter a valid business email.`);
    if (
      f.format === 'date' &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        value.startsWith('0000') ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    )
      errors.push(`${f.label}: enter a valid date.`);
  }
  if (
    kind === 'project' &&
    typeof values.start === 'string' &&
    typeof values.end === 'string' &&
    values.start &&
    values.end &&
    values.end < values.start
  )
    errors.push('Completion must follow the start date.');
  const money = template.fields.filter((f) => f.format === 'amount' && f.key !== 'quantity');
  if (money.some((f) => values[f.key]) && !values.currency)
    errors.push('Specify currency for monetary amounts.');
  return errors;
}

export function structuredSummary(kind: string, fields: Record<string, string>) {
  if (!Object.hasOwn(companyTemplates, kind)) return '';
  return (
    companyTemplates[kind]?.fields
      .filter((f) => fields[f.key])
      .map((f) => `${f.label}: ${fields[f.key]}`)
      .join('\n') ?? ''
  );
}
