export function evidenceLabel(key: string) {
  const labels: Record<string, string> = {
    entryMethod: 'Entry method',
    addedToBidXchange: 'Added to BidXchange',
    lastUpdated: 'Last updated',
    officialPublicationDate: 'Official publication date',
    lastSourceSync: 'Last source synchronization',
    deadlinePassed: 'Deadline passed',
    fitScore: 'Fit score',
    solicitationNumber: 'Solicitation number',
    effectiveDate: 'Effective date',
    opportunityId: 'Opportunity record',
    liveFeeds: 'Live procurement feeds',
    sourceNotes: 'Source notes',
    asOf: 'As of',
  };
  return labels[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}
export function evidenceValue(value: unknown) {
  if (value === null || value === undefined) return 'Unknown';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value).replaceAll('_', ' ');
}
