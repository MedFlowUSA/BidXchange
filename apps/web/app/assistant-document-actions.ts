'use server';
import { z } from 'zod';
import { accountContext, loadTenant } from '../lib/tenant';
import { prepareResponseDraft, responseCommand } from '../lib/response-command';
import { saveResponsePackage } from './response-package-actions';
import { workspaceHref } from '../lib/routes';

const inputSchema = z
  .object({
    organizationId: z.uuid(),
    pursuitId: z.uuid(),
    requestId: z.uuid(),
    prompt: z.string().max(3000),
  })
  .strict();
export async function createAssistantDocument(
  input: unknown,
): Promise<{ message: string; href?: string }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success)
    return { message: 'Open the bid in Pursuits before creating a response draft.' };
  const v = parsed.data;
  const kind = responseCommand(v.prompt);
  if (!kind)
    return {
      message: 'Use a direct command such as “Create a response outline for this solicitation”.',
    };
  try {
    const account = await accountContext();
    if (
      !account.user ||
      !account.choices.some(
        (c) =>
          c.id === v.organizationId && ['organization_admin', 'capture_manager'].includes(c.role),
      )
    )
      return { message: 'Capture or administrator access is required to create a response draft.' };
    const { data } = await loadTenant(v.organizationId, `/pursuits/${v.pursuitId}`, {
      kind: 'pursuit',
      id: v.pursuitId,
    });
    if (!data) return { message: 'This pursuit is unavailable.' };
    const draft = prepareResponseDraft(data, v.pursuitId, kind);
    const form = new FormData();
    for (const [key, value] of Object.entries({
      organization_id: v.organizationId,
      pursuit_id: v.pursuitId,
      creation_id: v.requestId,
      record_id: '',
      version: '',
      title: 'Assistant-prepared response',
      content: JSON.stringify(draft),
    }))
      form.set(key, value);
    const result = await saveResponsePackage({ message: '' }, form);
    if (!result.success || !result.id) return { message: result.message };
    return {
      message: `Your ${kind} response draft is saved with the bid details and requirement sections. This is a contractor response, not a buyer-issued solicitation. Narrative answers and any pricing still need to be completed and reviewed.`,
      href: workspaceHref(`/pursuits/${v.pursuitId}`, v.organizationId) + `#response-${result.id}`,
    };
  } catch {
    return { message: 'The response could not be created. Check your pursuit access and retry.' };
  }
}
