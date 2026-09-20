export const passportSteps = [
  {
    id: 'identity',
    question: 'Which company will sign the contract?',
    why: 'The legal entity and authorized representative must match the response.',
    items: [
      {
        type: 'identity',
        label: 'Legal business name',
        prompt:
          'Use the legal name shown on formation or registration documents. Note any operating name separately.',
      },
      {
        type: 'identity',
        label: 'Authorized company representative',
        prompt:
          'Identify the representative and role. Cite the basis of their authority; listing a person here does not authorize a bid.',
      },
    ],
  },
  {
    id: 'capabilities',
    question: 'What work can your company perform?',
    why: 'A service description and classification help a reviewer compare your experience with a notice.',
    items: [
      {
        type: 'capability',
        label: 'Core services and specialties',
        prompt:
          'Describe the work your own team performs, typical project types, and work that requires partners.',
      },
      {
        type: 'naics',
        label: 'NAICS classifications',
        prompt:
          'List known codes and descriptions with their source. A code alone does not establish eligibility.',
      },
      {
        type: 'psc',
        label: 'Product and service classifications',
        prompt: 'List relevant PSC codes if known, citing the source used to select them.',
      },
    ],
  },
  {
    id: 'territory',
    question: 'Where can you deliver the work?',
    why: 'Your service area, travel limits and local staffing affect whether a project is practical.',
    items: [
      {
        type: 'service_territory',
        label: 'Service area and travel limits',
        prompt:
          'Name states, counties or cities served, travel limits, and any conditions for work outside your normal area.',
      },
    ],
  },
  {
    id: 'licenses',
    question: 'Which licenses cover your work?',
    why: 'A reviewer needs the classification, jurisdiction and current evidence to compare a license with a solicitation.',
    items: [
      {
        type: 'license',
        label: 'Primary contractor or professional license',
        prompt:
          'Provide the issuing authority, public license number, classifications and status. Use the expiration field for renewal and cite the registry.',
      },
    ],
  },
  {
    id: 'registrations',
    question: 'Which registrations and certifications are current?',
    why: 'Requirements vary by buyer. Current evidence is needed before relying on a registration or set-aside claim.',
    items: [
      {
        type: 'registration',
        label: 'UEI and CAGE identifiers',
        prompt:
          'Record the public identifiers and the entity they identify. Do not include tax identifiers or account credentials.',
      },
      {
        type: 'registration',
        label: 'SAM registration',
        prompt:
          'Record the status, entity name, source and renewal date. Leave unknown status blank; do not assume active registration.',
      },
      {
        type: 'registration',
        label: 'State and local vendor registrations',
        prompt:
          'Identify each buyer or portal and registration status with a reference. Never enter portal passwords.',
      },
      {
        type: 'certification',
        label: 'Business certifications',
        prompt:
          'List the issuing body, certification, scope and current evidence. Certification does not automatically establish eligibility for a specific notice.',
      },
    ],
  },
  {
    id: 'coverage',
    question: 'What insurance and bonding can you support?',
    why: 'A single-project limit and remaining aggregate capacity answer different questions. Both need current evidence.',
    items: [
      {
        type: 'insurance',
        label: 'Insurance coverage and endorsements',
        prompt:
          'Summarize policy types, coverage limits, exclusions and endorsements. Cite the current certificate and enter its expiration date.',
      },
      {
        type: 'bonding',
        label: 'Single-project bonding limit',
        prompt:
          'State the amount, currency and conditions supported by a current surety letter. Leave unsupported limits blank.',
      },
      {
        type: 'bonding',
        label: 'Aggregate bonding capacity',
        prompt:
          'Record the total limit, current bonded backlog and remaining capacity if confirmed by the surety. Include the date of the assessment.',
      },
    ],
  },
  {
    id: 'capacity',
    question: 'What capacity is available now?',
    why: 'Staffing, equipment and backlog can change whether you can deliver the proposed work.',
    items: [
      {
        type: 'capacity',
        label: 'Available workforce and backlog',
        prompt:
          'Describe available crews or staff, committed work and the period this assessment covers. Avoid private employee details.',
      },
      {
        type: 'capacity',
        label: 'Equipment availability',
        prompt: 'Identify relevant owned or leased equipment, availability dates and dependencies.',
      },
      {
        type: 'financial',
        label: 'Financial capacity summary',
        prompt:
          'Provide an authorized high-level summary and evidence reference. Do not enter bank account numbers, credentials or full tax identifiers.',
      },
    ],
  },
  {
    id: 'experience',
    question: 'Which completed projects show comparable experience?',
    why: 'A reviewer needs comparable scope and evidence, not just a list of project names.',
    items: [
      {
        type: 'past_performance',
        label: 'Comparable project reference',
        prompt:
          'Describe the client, scope, dates, your role and documented outcome. Note whether reference contact or proposal-use permission has been obtained.',
      },
    ],
  },
  {
    id: 'people',
    question: 'Who would lead and perform the work?',
    why: 'Qualifications and actual availability matter when a notice names key-personnel requirements.',
    items: [
      {
        type: 'personnel',
        label: 'Key personnel qualifications',
        prompt:
          'Identify relevant roles, professional qualifications and availability. Cite a resume reference; leave out home addresses and sensitive personal identifiers.',
      },
    ],
  },
  {
    id: 'compliance',
    question: 'Which safety and compliance evidence applies?',
    why: 'Applicable requirements depend on the work and buyer; an empty answer is not a compliance finding.',
    items: [
      {
        type: 'safety',
        label: 'Safety program and performance',
        prompt:
          'Reference the applicable safety program and dated performance evidence. Do not estimate unsupported metrics.',
      },
      {
        type: 'compliance',
        label: 'Compliance matters for review',
        prompt:
          'Identify applicable obligations or questions for an authorized reviewer, with source references.',
      },
    ],
  },
  {
    id: 'assets',
    question: 'Which materials support your company information?',
    why: 'A source reference helps a reviewer locate evidence. Proposal-use approval is a separate control.',
    items: [
      {
        type: 'proposal_asset',
        label: 'Capability statement and proposal materials',
        prompt:
          'Reference the document title, version, owner and review date. Uploads and formal proposal-use approvals are not yet available; this entry does not approve reuse.',
      },
    ],
  },
] as const;
