import { z } from 'zod';
import { opportunityInput } from './capture-input';

export const pepmaHome = 'https://www.pepma-ca.com/Public/Default.aspx';
export function isPepmaUrl(value: string | null | undefined) {
  try {
    const url = new URL(value ?? '');
    return (
      url.protocol === 'https:' &&
      ['www.pepma-ca.com', 'pepma-ca.com'].includes(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.port
    );
  } catch {
    return false;
  }
}
export const pepmaInput = z.object({
  organization_id: z.uuid(),
  title: z.string().trim().min(1).max(200),
  solicitation_number: z.string().trim().min(1, 'Enter the PEPMA bid number.').max(200),
  source_url: z
    .string()
    .max(2000)
    .refine(isPepmaUrl, 'Use the HTTPS PEPMA bid page or home page, without credentials.'),
  buyer: z.enum(['SCE', 'SoCalGas', 'PG&E', 'SDG&E', 'Joint IOU']),
  bid_category: z.enum([
    'Professional services',
    'Third-party program',
    'Other / confirm with buyer',
  ]),
  service_area: z.string().trim().min(1).max(200),
  bid_manager: z.string().trim().max(200),
  question_deadline: z.union([z.iso.datetime({ offset: true }), z.literal('')]),
  official_deadline: z.union([z.iso.datetime({ offset: true }), z.literal('')]),
  summary: z.string().trim().max(6000),
  source_note: z.string().trim().min(1, 'Record the invitation or source reference.').max(700),
  latest_update: z.string().trim().max(200),
  confirmed: z.literal(
    'yes',
    'Confirm that you checked the bid details and may record them in this workspace.',
  ),
});

// Persist readable source details in the existing audited opportunity record. No shadow store.
export function pepmaOpportunity(input: z.infer<typeof pepmaInput>, now = new Date()) {
  return opportunityInput.parse({
    organization_id: input.organization_id,
    record_id: '',
    updated_at: '',
    title: input.title,
    buyer: input.buyer,
    solicitation_number: input.solicitation_number,
    source_url: input.source_url,
    summary: input.summary,
    official_deadline: input.official_deadline,
    deadline_timezone: 'America/Los_Angeles',
    source_note: [
      'PEPMA — manually recorded invitation; no account synchronization.',
      `Category: ${input.bid_category}`,
      `IOU service area: ${input.service_area}`,
      `Bid manager: ${input.bid_manager || 'Not recorded'}`,
      `Questions due (recorded offset): ${input.question_deadline || 'Not recorded'}`,
      `Latest addendum / Q&A reference: ${input.latest_update || 'Not recorded'}`,
      `Intake recorded at: ${now.toISOString()}; not a portal sync timestamp.`,
      `Invitation / source reference: ${input.source_note}`,
    ].join('\n'),
  });
}

export const pepmaChecks = [
  {
    title: 'Invitation, scope and service area',
    text: 'Confirm the sponsoring utility, invited entity, service territory and scope against the bid page.',
  },
  {
    title: 'Questions and addenda',
    text: 'Check the PEPMA Message Center and Quick Links. Record each relevant change against its requirement and assign a deadline for unanswered questions.',
  },
  {
    title: 'Company qualifications',
    text: 'Capture the actual qualification clauses, then link current GES or selected-company evidence and record gaps. Templates are not buyer requirements.',
  },
  {
    title: 'Business proposal',
    text: 'Check the requested narrative, delivery plan, experience and response format. Keep cost elements in the cost proposal when instructed by the buyer.',
  },
  {
    title: 'Cost proposal',
    text: 'Check commercial terms, pricing schedules and required approvals. A narrative PDF does not replace the buyer’s pricing workbook.',
  },
  {
    title: 'Technical documentation and summary of offer',
    text: 'For third-party program bids, check whether a summary of offer and technical or cost-effectiveness documentation are required. Follow the specific RFx.',
  },
  {
    title: 'Submission confirmation',
    text: 'Submit approved files in PEPMA, then record its confirmation number and receipt reference in the submission record. A BidXchange approval is not portal delivery.',
  },
];
