import { z } from 'zod';

export const companyCreationInput = z.object({
  legal_name: z.string().trim().min(1).max(200),
  operating_name: z.string().trim().min(1).max(200),
  request_id: z.uuid(),
});
export const invitationRoles = {
  viewer: 'Viewer — read permitted workspace records',
  estimator: 'Estimator — estimating and assigned pursuit work',
  capture_manager: 'Bid lead — manage pursuits and tasks',
  executive_approver: 'Approver — attest evidence and approve response versions',
  organization_admin: 'Administrator — company records, members and all workspace controls',
} as const;
export const invitationInput = z.object({
  organization_id: z.uuid(),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  role: z.enum([
    'viewer',
    'estimator',
    'capture_manager',
    'executive_approver',
    'organization_admin',
  ]),
});
export type IncomingInvitation = {
  id: string;
  organization_name: string;
  role: string;
  expires_at: string;
};
export type ManagedInvitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
};
export function roleLabel(role: string) {
  return (
    invitationRoles[role as keyof typeof invitationRoles]?.split(' — ')[0] ??
    role.replaceAll('_', ' ')
  );
}
