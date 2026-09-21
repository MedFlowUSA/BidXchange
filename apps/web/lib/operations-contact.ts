// Business routing only. This does not grant application or tenant permissions.
export const operationsContact = {
  name: 'Manuel Rodriguez',
  email: 'mrodriguez@oaisinc.com',
} as const;

export const demoContactHref = `mailto:${operationsContact.email}?subject=${encodeURIComponent('BidXchange bid review request')}`;
