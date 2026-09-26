import { reviewedPortalUrl } from './sources/portal-url';
/** Preparation checks only. Existing release RPCs remain the production authority. */
export function handoffGaps(input: {
  signed: boolean;
  evidenceCurrent: boolean;
  addendaAcknowledged: boolean;
  bidCurrent: boolean;
  submitter: string;
  destination: string;
  humanComplete: boolean;
}) {
  return [
    !input.signed && 'Sign off the current requirements register.',
    !input.evidenceCurrent && 'Review expired or stale cited Passport evidence.',
    !input.addendaAcknowledged && 'Acknowledge every addendum.',
    !input.bidCurrent && 'Record or reaffirm a current bid decision.',
    !input.submitter.trim() && 'Name the person who will submit.',
    !input.destination.trim() && 'Record the official submission destination.',
    !input.humanComplete &&
      'Confirm that price and representations are complete outside BidXchange.',
  ].filter((gap): gap is string => typeof gap === 'string');
}

export const PLAYBOOK_VERSION = '2026-09-26.1';
export const EXTERNAL_COMPLETION = 'Price and representations are complete outside BidXchange';
export function safePortalUrl(value: string) {
  const safe = reviewedPortalUrl(value);
  return safe?.startsWith('https:') ? safe : null;
}
export function portalPlaybook(portal: string) {
  if (/planetbids/i.test(portal))
    return {
      name: 'PlanetBids',
      source: 'https://home.planetbids.com/vendor-support',
      steps: [
        'Confirm the agency accepts electronic bids and the person submitting is authorized to sign.',
        'Where a PIN is required, obtain it through the primary contact in PlanetBids. Never enter it here.',
        'Complete the portal’s required fields and attachments. Review all addenda; if a submitted eBid is invalidated by an addendum, acknowledge and resubmit before the deadline.',
        'Retain the portal confirmation and email. Resolve missing confirmation with the buyer or portal support.',
      ],
    };
  if (/cal eprocure|cscr|caleprocure/i.test(portal))
    return {
      name: 'Cal eProcure / CSCR',
      source: 'https://caleprocure.ca.gov/',
      steps: [
        'Open the official notice and follow its response instructions.',
        'If the notice specifies a file-share invitation, obtain it from the buyer before the deadline.',
        'Category codes and bid notifications help discover notices; they do not record a submitted response.',
      ],
    };
  if (/sam\.gov/i.test(portal))
    return {
      name: 'SAM.gov',
      source: 'https://sam.gov/opportunities',
      steps: [
        'Open the official notice and latest amendments.',
        'Use the issuing agency’s specified response destination, format and deadline. A SAM notice link is not a submission receipt.',
      ],
    };
  if (/email|physical/i.test(portal))
    return {
      name: 'Email / physical delivery',
      source: null,
      steps: [
        'Confirm the exact address, recipient, copies and package or subject-line labeling in the notice.',
        'Allow time for delivery and retain the acknowledgment or delivery receipt. Record any receipt limitation.',
      ],
    };
  return {
    name: 'Buyer portal',
    source: null,
    steps: [
      'Open the buyer’s official notice link and confirm the current response instructions.',
      'For SAP Ariba, SCE PEPMA, LAUSD or county ePro, complete submission in the buyer’s system using your own authorized account.',
      'Retain the confirmation and record what happened here.',
    ],
  };
}
