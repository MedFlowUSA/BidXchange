import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  demoCookie,
  verifyDemoCookie,
  demoHash,
  demoRequest,
  DEMO_INSTRUCTIONS,
} from '../../../lib/ai/public-demo';
import { readJsonBody } from '../../../lib/ai/read-body';
export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const cookieName = 'bidx-demo-ai';
function config() {
  const env = process.env;
  if (
    env.BIDXCHANGE_AI_PUBLIC_DEMO_ENABLED !== 'true' ||
    !env.OPENAI_API_KEY ||
    !env.OPENAI_MODEL ||
    !env.SUPABASE_URL ||
    !env.BIDXCHANGE_DEMO_AI_SERVICE_KEY
  )
    return null;
  return {
    key: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    url: env.SUPABASE_URL,
    service: env.BIDXCHANGE_DEMO_AI_SERVICE_KEY,
  };
}
function database(c: NonNullable<ReturnType<typeof config>>) {
  return createClient(c.url, c.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
function reply(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers });
}
export async function GET(request: NextRequest) {
  try {
    const c = config();
    if (!c) return NextResponse.json({ available: false }, { headers });
    const state = await database(c)
      .from('demo_ai_settings')
      .select('enabled')
      .eq('id', true)
      .single();
    if (state.error || !state.data?.enabled)
      return NextResponse.json({ available: false }, { headers });
    const result = NextResponse.json({ available: true, limit: 5 }, { headers });
    if (!verifyDemoCookie(c.service, request.cookies.get(cookieName)?.value ?? ''))
      result.cookies.set(cookieName, demoCookie(c.service, randomUUID()), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/demo-assistant',
        maxAge: 86400,
      });
    return result;
  } catch {
    return NextResponse.json({ available: false }, { headers });
  }
}
export async function POST(request: NextRequest) {
  try {
    const allowed =
      process.env.NODE_ENV === 'production' ? process.env.SITE_URL : 'http://127.0.0.1:3000';
    if (!allowed || request.headers.get('origin') !== new URL(allowed).origin)
      return reply('Open the demo on BidXchange to ask a question.', 403);
    const c = config();
    if (!c) return reply('Live demo AI is temporarily unavailable.', 503);
    const id = verifyDemoCookie(c.service, request.cookies.get(cookieName)?.value ?? '');
    if (!id) return reply('Reload the demo to start your AI session.', 403);
    const body = demoRequest.safeParse(await readJsonBody(request, 8192));
    if (!body.success) return reply('Enter a question of 1–1,500 characters.', 400);
    // Vercel supplies this edge header. A global database ceiling also applies regardless of IP.
    const network =
      process.env.VERCEL === '1'
        ? request.headers.get('x-vercel-forwarded-for')
        : process.env.NODE_ENV !== 'production'
          ? 'local'
          : null;
    if (!network) return reply('Live demo AI is temporarily unavailable.', 503);
    const db = database(c);
    const reserved = await db.rpc('reserve_demo_ai', {
      request_id: body.data.requestId,
      visitor_hash: demoHash(c.service, 'visitor|' + id),
      network_hash: demoHash(c.service, 'network|' + network),
    });
    if (reserved.error) return reply('Live demo AI is temporarily unavailable.', 503);
    if (reserved.data !== 'reserved')
      return reply(
        reserved.data === 'wait'
          ? 'Please wait one minute between demo questions.'
          : reserved.data === 'disabled'
            ? 'Live demo AI is temporarily unavailable.'
            : 'This demo has reached its usage allowance. Please try again tomorrow.',
        reserved.data === 'disabled' ? 503 : 429,
      );
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30000)]);
    const answer = await new OpenAI({
      apiKey: c.key,
      maxRetries: 0,
      timeout: 30000,
    }).responses.create(
      {
        model: c.model,
        store: false,
        max_output_tokens: 600,
        reasoning: { effort: 'none' },
        instructions: DEMO_INSTRUCTIONS,
        input: [{ role: 'user', content: body.data.prompt }],
      },
      { signal },
    );
    const state = await db.from('demo_ai_settings').select('enabled').eq('id', true).single();
    if (state.error || !state.data?.enabled || !config())
      return reply('Live demo AI is temporarily unavailable.', 503);
    if (
      answer.status !== 'completed' ||
      !answer.output_text?.trim() ||
      answer.output_text.length > 12000 ||
      answer.output.some((item) => item.type === 'function_call')
    )
      return reply(
        'The answer could not be completed. Try a shorter question after one minute.',
        503,
      );
    return NextResponse.json(
      {
        answer: answer.output_text,
        notice: 'Live AI response. No company records or live sources were accessed.',
      },
      { headers },
    );
  } catch {
    return reply('The AI could not complete this request. Please try again after one minute.', 503);
  }
}
