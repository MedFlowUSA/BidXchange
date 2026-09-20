import type { OrganizationChoice } from './routes';
export type Organization = OrganizationChoice & {
  legal_name: string;
  slug: string;
  website: string | null;
  status: string;
  default_timezone: string;
  organization_type: string;
};
export type Fact = {
  id: string;
  fact_type: string;
  label: string;
  value: string | null;
  verification_status: string;
  source_reference: string | null;
  source_note: string | null;
  verified_by: string | null;
  verified_at: string | null;
  expiration_date: string | null;
  effective_date?: string | null;
  updated_at: string;
};
export type LiveOpportunity = {
  id: string;
  title: string;
  solicitation_number: string | null;
  buyer: string | null;
  source_url: string | null;
  source_note: string | null;
  official_deadline: string | null;
  deadline_timezone: string;
  summary: string | null;
  estimated_value: number | null;
  status: string;
};
export type LivePursuit = {
  id: string;
  title: string;
  opportunity_id: string;
  decision: string;
  status: string;
};
export type TenantData = {
  reviewAsOf: string;
  organization: Organization;
  choices: OrganizationChoice[];
  userEmail: string;
  userId: string;
  facts: Fact[];
  onboarding: { id: string; label: string; status: string }[];
  sources: { id: string; name: string; access_status: string; notes: string | null }[];
  opportunities: LiveOpportunity[];
  pursuits: LivePursuit[];
  documents: { id: string; title: string; document_type: string; scan_status: string }[];
  members: { id: string; user_id: string; role: string; status: string }[];
  audit: {
    id: string;
    entity_table: string;
    action: string;
    created_at: string;
    actor_user_id: string | null;
  }[];
  tasks: { id: string; pursuit_id: string; title: string; status: string }[];
};
