import { z } from 'zod';
import { authorizeAi, requireSameOrigin } from '../../../../lib/ai/server';
import { aiConfig } from '../../../../lib/ai/config';
import { AiError, errorMessages } from '../../../../lib/ai/contracts';
import { readJsonBody } from '../../../../lib/ai/read-body';
import { readSavedConversation } from '../../../../lib/ai/saved-conversation';
import { checkConversation, renewConversation } from '../../../../lib/ai/conversation';
import { EvidenceTools } from '../../../../lib/ai/tools';
import {
  readSharedRequirement,
  readSharedRequirements,
  sharingContext,
} from '../../../../lib/ai/requirement-sharing';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const identity = z.object({ organizationId: z.uuid(), pursuitId: z.uuid() }).strict();
const input = identity
  .extend({
    action: z.enum(['save', 'resume', 'delete']),
    checkpoint: z.string().max(150000).optional(),
  })
  .strict();
function failure(error: unknown) {
  const e = error instanceof AiError ? error : new AiError('service_unavailable', 503);
  return Response.json(
    { code: e.code, message: errorMessages[e.code] ?? 'Saved conversation unavailable.' },
    { status: e.status, headers },
  );
}
async function accountFor(org: string, pursuit: string) {
  const account = await authorizeAi(org);
  const tools = new EvidenceTools(account.db, org, account.role, new Date(), 80);
  await tools.restrictToContext({ kind: 'pursuit', id: pursuit });
  await tools.source('pursuit', pursuit);
  return { ...account, tools };
}
export async function GET(request: Request) {
  try {
    const parsed = identity.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new AiError('invalid_request');
    const { organizationId: org, pursuitId: pursuit } = parsed.data;
    const { db, user } = await accountFor(org, pursuit);
    const row = await db
      .from('ai_bid_conversations')
      .select('saved_at,expires_at')
      .eq('organization_id', org)
      .eq('user_id', user.id)
      .eq('pursuit_id', pursuit)
      .maybeSingle();
    if (row.error) throw new AiError('service_unavailable', 503);
    return Response.json({ saved: row.data }, { headers });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const parsed = input.safeParse(await readJsonBody(request, 160000));
    if (!parsed.success) throw new AiError('invalid_request');
    const { organizationId: org, pursuitId: pursuit, action, checkpoint } = parsed.data;
    const account = await accountFor(org, pursuit),
      { db, user, role, tools } = account;
    if (action === 'delete') {
      const removed = await db
        .from('ai_bid_conversations')
        .delete()
        .eq('organization_id', org)
        .eq('user_id', user.id)
        .eq('pursuit_id', pursuit);
      if (removed.error) throw new AiError('service_unavailable', 503);
      return Response.json({ deleted: true }, { headers });
    }
    const config = aiConfig();
    const enabled = await db
      .from('ai_organization_settings')
      .select('enabled')
      .eq('organization_id', org)
      .maybeSingle();
    if (!config || enabled.error || !enabled.data?.enabled) throw new AiError('unavailable', 503);
    let token = checkpoint;
    if (action === 'resume') {
      const row = await db
        .from('ai_bid_conversations')
        .select('encrypted_payload')
        .eq('organization_id', org)
        .eq('user_id', user.id)
        .eq('pursuit_id', pursuit)
        .maybeSingle();
      if (row.error) throw new AiError('service_unavailable', 503);
      token = row.data?.encrypted_payload;
    }
    if (!token) throw new AiError('invalid_request');
    const saved = readSavedConversation(token, config.key, {
      user: user.id,
      organization: org,
      role,
      pursuit,
    });
    const context = { kind: 'pursuit' as const, id: pursuit };
    const selection = saved.answer.sharedRequirements ?? saved.answer.sharedRequirement;
    if (saved.memory.scope.context !== sharingContext(context, selection))
      throw new AiError('conversation_changed', 409);
    await checkConversation(saved.memory, (type, id) => tools.source(type, id));
    const shared = Array.isArray(selection)
      ? await readSharedRequirements(db, org, role, context, 'workspace', selection)
      : await readSharedRequirement(db, org, role, context, 'workspace', selection);
    if (JSON.stringify(shared) !== JSON.stringify(selection))
      throw new AiError('conversation_changed', 409);
    const fresh = await authorizeAi(org);
    if (fresh.user.id !== user.id || fresh.role !== role) throw new AiError('forbidden', 403);
    const stillEnabled = await fresh.db
      .from('ai_organization_settings')
      .select('enabled')
      .eq('organization_id', org)
      .maybeSingle();
    if (stillEnabled.error || !stillEnabled.data?.enabled) throw new AiError('unavailable', 503);
    if (action === 'save') {
      const row = await fresh.db
        .from('ai_bid_conversations')
        .upsert(
          {
            organization_id: org,
            user_id: user.id,
            pursuit_id: pursuit,
            checkpoint_id: saved.id,
            role,
            encrypted_payload: token,
            saved_at: new Date().toISOString(),
            expires_at: new Date(saved.expires).toISOString(),
          },
          { onConflict: 'organization_id,user_id,pursuit_id' },
        );
      if (row.error) throw new AiError('service_unavailable', 503);
      return Response.json({ saved: true }, { headers });
    }
    // Resume recent dialogue, never resurrect a task-saving capability.
    const answer = {
      ...saved.answer,
      actionToken: undefined,
      saveCheckpoint: undefined,
      continuation: renewConversation(saved.memory, config.key),
    };
    return Response.json({ answer, turns: saved.memory.turns }, { headers });
  } catch (error) {
    return failure(error);
  }
}
