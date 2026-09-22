import { z } from 'zod';
import { authorizeAi, requireSameOrigin } from '../../../../../lib/ai/server';
import { AiError } from '../../../../../lib/ai/contracts';
import { researchPlan } from '../../../../../lib/research/contracts';
import { readJsonBody } from '../../../../../lib/ai/read-body';
const headers = { 'Cache-Control': 'private, no-store' };
const save = z
  .object({
    organizationId: z.uuid(),
    name: z.string().trim().min(1).max(120),
    prompt: z.string().trim().min(1).max(3000),
    plan: researchPlan,
  })
  .strict();
export async function GET(request: Request) {
  try {
    const org = z.uuid().parse(new URL(request.url).searchParams.get('organizationId'));
    const account = await authorizeAi(org);
    const result = await account.db
      .from('research_saved_searches')
      .select('id,name,prompt,plan,created_at')
      .eq('organization_id', org)
      .eq('user_id', account.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (result.error) throw new Error('read');
    return Response.json({ searches: result.data }, { headers });
  } catch (error) {
    return Response.json(
      { message: 'Saved searches unavailable.' },
      { status: error instanceof AiError ? error.status : 503, headers },
    );
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const value = save.parse(await readJsonBody(request, 18000));
    const account = await authorizeAi(value.organizationId);
    const quota = await account.db.rpc('consume_admin_mutation');
    if (quota.error || quota.data !== true) throw new AiError('rate_limited', 429);
    const result = await account.db
      .from('research_saved_searches')
      .insert({
        organization_id: value.organizationId,
        user_id: account.user.id,
        name: value.name,
        prompt: value.prompt,
        plan: value.plan,
      })
      .select('id')
      .single();
    if (result.error) throw new Error('save');
    return Response.json({ id: result.data.id }, { headers });
  } catch (error) {
    return Response.json(
      { message: 'Could not save the search. Check access and try again.' },
      { status: error instanceof AiError ? error.status : 400, headers },
    );
  }
}
export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const value = z
      .object({ organizationId: z.uuid(), id: z.uuid() })
      .strict()
      .parse(await readJsonBody(request, 1000));
    const account = await authorizeAi(value.organizationId);
    const result = await account.db
      .from('research_saved_searches')
      .delete()
      .eq('organization_id', value.organizationId)
      .eq('user_id', account.user.id)
      .eq('id', value.id)
      .select('id');
    if (result.error || !result.data.length) throw new Error('delete');
    return Response.json({ deleted: true }, { headers });
  } catch (error) {
    return Response.json(
      { message: 'Could not remove the saved search.' },
      { status: error instanceof AiError ? error.status : 400, headers },
    );
  }
}
