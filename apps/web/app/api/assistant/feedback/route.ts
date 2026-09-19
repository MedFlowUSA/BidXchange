import { z } from 'zod';
import { authorizeAi, requireSameOrigin } from '../../../../lib/ai/server';
import { readJsonBody } from '../../../../lib/ai/read-body';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const json = await readJsonBody(request, 300);
    const body = z
      .object({
        organizationId: z.uuid(),
        requestId: z.uuid(),
        rating: z.enum(['helpful', 'unhelpful']),
      })
      .strict()
      .parse(json);
    const { db } = await authorizeAi(body.organizationId);
    const { data, error } = await db.rpc('ai_feedback', {
      org: body.organizationId,
      request_id: body.requestId,
      rating: body.rating,
    });
    return Response.json(
      { saved: !error && data === true },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return Response.json(
      { saved: false },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
