export type ConnectionMode = 'official_api' | 'authorized_portal' | 'import' | 'manual';
export type SourceDefinition = {
  id: string;
  name: string;
  group: 'opportunities' | 'vehicles' | 'research';
  coverage: string;
  platform: string;
  priority: 1 | 2 | 3;
  url: string | null;
  mode: ConnectionMode;
  categories: string;
  scheduleRequired?: boolean;
};
const source = (
  id: string,
  name: string,
  coverage: string,
  platform: string,
  url: string | null = null,
  priority: 1 | 2 | 3 = 1,
  group: SourceDefinition['group'] = 'opportunities',
): SourceDefinition => ({
  id,
  name,
  coverage,
  platform,
  url,
  priority,
  group,
  mode: 'manual',
  categories:
    group === 'vehicles'
      ? 'Awarded purchasing vehicles; review eligibility and scope'
      : group === 'research'
        ? 'Award and incumbent research; not a bid submission source'
        : 'Review the agency-specific solicitation and categories',
});
export const sourceRegistry: SourceDefinition[] = [
  {
    ...source(
      'sam.gov',
      'SAM.gov Contract Opportunities',
      'Federal',
      'SAM.gov',
      'https://sam.gov/opportunities',
    ),
    mode: 'official_api',
  },
  source(
    'pepma',
    'PEPMA energy-efficiency invitations',
    'California utilities',
    'PEPMA',
    'https://www.pepma-ca.com/Public/Default.aspx',
  ),
  source(
    'cal-eprocure',
    'Cal eProcure / CSCR',
    'California',
    'FI$Cal',
    'https://caleprocure.ca.gov/',
  ),
  source(
    'sce-ariba',
    'SCE SAP Ariba',
    'SCE service territory',
    'SAP Ariba',
    'https://www.sce.com/partners/3rd-party-energy-providers/supply-chain-management',
  ),
  source(
    'sce-public',
    'SCE public bid listings',
    'SCE service territory',
    'SCE',
    'https://www.sce.com/partners/partner-resources/buying-selling/bid-opportunities',
  ),
  source(
    'ladwp',
    'LADWP eRSP',
    'Los Angeles',
    'eRSP',
    'https://www.ladwp.com/doing-business-ladwp/vendors-and-bidders',
  ),
  source(
    'rampla',
    'City of Los Angeles RAMPLA',
    'Los Angeles',
    'RAMPLA',
    'https://www.rampla.org/',
  ),
  source(
    'lausd-ariba',
    'LAUSD SAP Ariba',
    'Los Angeles schools',
    'SAP Ariba',
    'https://procurement.lausd.org/',
  ),
  source(
    'lausd-facilities',
    'LAUSD Facilities / prequalification',
    'Los Angeles schools',
    'Agency / QualityBidders',
    'https://procurement.lausd.org/apps/pages/Prequalification',
  ),
  source(
    'sb-epro',
    'San Bernardino County ePro',
    'San Bernardino County',
    'ePro',
    'https://epro.sbcounty.gov/bso/',
  ),
  source(
    'planetbids',
    'PlanetBids agency portals',
    'Agency-specific',
    'PlanetBids',
    'https://home.planetbids.com/vendor-support',
  ),
  source(
    'opengov',
    'OpenGov Procurement agency portals',
    'Agency-specific',
    'OpenGov',
    'https://opengov.com/products/procurement/for-vendor/',
  ),
  source('bonfire', 'Bonfire agency portals', 'Agency-specific', 'Bonfire'),
  source(
    'ventura',
    'Ventura County Bonfire',
    'Ventura County',
    'Bonfire',
    'https://ventura.bonfirehub.com/portal',
  ),
  source(
    'orange',
    'Orange County procurement',
    'Orange County',
    'OpenGov',
    'https://cpo.ocgov.com/',
    2,
  ),
  source('riverside', 'Riverside County procurement', 'Riverside County', 'Agency portal', null, 2),
  source(
    'la-county',
    'Los Angeles County procurement',
    'Los Angeles County',
    'Agency portal',
    null,
    2,
  ),
  source('metro', 'LA Metro procurement', 'Los Angeles region', 'Agency portal', null, 2),
  source(
    'socalgas',
    'SoCalGas supplier opportunities',
    'Southern California',
    'Supplier portal',
    null,
    2,
  ),
  source('sdge', 'SDG&E supplier opportunities', 'San Diego region', 'Supplier portal', null, 2),
  ...['SAP Ariba', 'Public Purchase', 'DemandStar', 'BidNet Direct', 'IonWave', 'JAGGAER'].map(
    (name) =>
      source(
        name.toLowerCase().replaceAll(' ', '-'),
        `${name} agency portals`,
        'Agency-specific',
        name,
        null,
        2,
      ),
  ),
  source('subnet', 'SBA SUBNet', 'Federal subcontracting', 'SBA', 'https://www.sba.gov/subnet', 3),
  {
    ...source('gsa-ebuy', 'GSA eBuy', 'Federal', 'GSA eBuy', 'https://www.ebuy.gsa.gov/', 3),
    scheduleRequired: true,
  },
  source('dla', 'DLA DIBBS', 'Federal supply', 'DLA', null, 3),
  source('piee', 'PIEE', 'Department of Defense', 'PIEE', null, 3),
  source('unison', 'Unison Marketplace', 'Federal', 'Unison', null, 3),
  ...[
    'CMAS',
    'California Leveraged Procurement Agreements',
    'NASPO ValuePoint',
    'Sourcewell',
    'OMNIA Partners',
    'TIPS',
    'HGACBuy',
    'BuyBoard',
    'PEPPM',
    'Job Order Contracting',
    'GSA Multiple Award Schedule',
  ].map((name) =>
    source(
      name.toLowerCase().replaceAll(' ', '-'),
      name,
      'Vehicle-specific',
      'Contract vehicle',
      null,
      2,
      'vehicles',
    ),
  ),
  source(
    'usaspending',
    'USAspending.gov',
    'Federal awards',
    'USAspending',
    'https://www.usaspending.gov/search',
    3,
    'research',
  ),
  source(
    'federal-awards',
    'SAM / FPDS award research',
    'Federal awards',
    'Federal award data',
    null,
    3,
    'research',
  ),
  source(
    'fiscal-info',
    'FI$Cal procurement information',
    'California',
    'FI$Cal',
    null,
    2,
    'research',
  ),
];
export const connectionLabels: Record<ConnectionMode, string> = {
  official_api: 'Official API',
  authorized_portal: 'Authorized portal connector',
  import: 'Reviewed import',
  manual: 'Manual intake / external handoff',
};
export function findSource(id: string) {
  return sourceRegistry.find((s) => s.id === id);
}
