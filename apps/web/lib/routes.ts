export const sections: Record<string, string> = {
  Today: '/dashboard',
  Assistant: '/assistant',
  Opportunities: '/opportunities',
  Pursuits: '/pursuits',
  Company: '/company',
  Documents: '/documents',
  Reports: '/reports',
  Settings: '/settings',
};
export function workspaceHref(path: string, organizationId?: string) {
  return `${path}?${organizationId ? `organization=${encodeURIComponent(organizationId)}` : 'workspace=demo'}`;
}
export function safeNext(value: unknown) {
  return typeof value === 'string' &&
    /^\/(assistant|dashboard|opportunities|pursuits|company|documents|reports|settings|operations)(\?|\/|$)/.test(
      value,
    ) &&
    !value.includes('\\') &&
    !/[\r\n]/.test(value)
    ? value
    : '/dashboard';
}
export type OrganizationChoice = { id: string; operating_name: string; role: string };
export type SearchRecord = { title: string; category: string; href: string; text?: string };
