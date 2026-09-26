'use server';
import { z } from 'zod';
import type { MutationState } from './actions';
import { savePursuitTask } from './capture-actions';
import { authorizeAi } from '../lib/ai/server';
import { aiConfig } from '../lib/ai/config';
import { readConversation, checkConversation } from '../lib/ai/conversation';
import { EvidenceTools } from '../lib/ai/tools';
import { taskInput } from '../lib/capture-input';

export async function saveAssistantTask(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const parsed = taskInput.safeParse(Object.fromEntries(form));
  const token = z.string().min(1).max(70000).safeParse(form.get('action_token'));
  if (
    !parsed.success ||
    !token.success ||
    !parsed.data.creation_id ||
    parsed.data.record_id ||
    form.get('review_confirmed') !== 'on'
  )
    return { message: 'Review the proposed task, owner and date before saving.' };
  const input = parsed.data;
  try {
    const account = await authorizeAi(input.organization_id);
    if (!['organization_admin', 'capture_manager'].includes(account.role))
      return { message: 'Capture or administrator access is required to save a task.' };
    const config = aiConfig();
    if (!config) return { message: 'Refresh the assistant before saving this proposal.' };
    const scope = {
      user: account.user.id,
      organization: input.organization_id,
      role: account.role,
      mode: 'workspace',
      context: 'task-plan:' + JSON.stringify({ kind: 'pursuit', id: input.pursuit_id }),
    };
    const plan = readConversation(token.data, config.key, scope);
    if (!plan.refs.some((r) => r.type === 'pursuit' && r.id === input.pursuit_id))
      throw new Error('scope');
    if (
      input.requirement_id &&
      !plan.refs.some((r) => r.type === 'requirement' && r.id === input.requirement_id)
    )
      throw new Error('requirement');
    const tools = new EvidenceTools(account.db, input.organization_id, account.role);
    await checkConversation(plan, (type, id) => tools.source(type, id));
    if (input.requirement_id) {
      const requirement = tools.evidence.get(`requirement:${input.requirement_id}`);
      if (
        requirement?.fields.workspaceRoute !==
        `/pursuits/${input.pursuit_id}?organization=${input.organization_id}`
      )
        throw new Error('parent');
    }
    const safe = new FormData();
    for (const [key, value] of Object.entries(input)) if (value !== undefined) safe.set(key, value);
    safe.set('status', 'todo');
    return await savePursuitTask({ message: '' }, safe);
  } catch {
    return {
      message:
        'The plan expired, its source records changed, or access is unavailable. Refresh the assistant answer before saving. Your draft has been kept.',
    };
  }
}
