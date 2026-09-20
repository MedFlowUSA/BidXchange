'use server';

import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { headers } from 'next/headers';
import { demoRequestSchema, type DemoRequestState } from '../lib/demo-request';
import { demoIntakeConfig, intakeDatabase } from '../lib/demo-intake-server';

export async function requestDemo(
  _state: DemoRequestState,
  form: FormData,
): Promise<DemoRequestState> {
  const unavailable = {
    message: 'The request could not be saved. Please email Manuel using the contact link below.',
  };
  try {
    const config = demoIntakeConfig();
    if (!config) return unavailable;
    const parsed = demoRequestSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success)
      return {
        message:
          'Check your name, work email, company and contact consent. Keep the message under 1,500 characters.',
      };
    const requestHeaders = await headers();
    // Vercel overwrites this header at its edge. Never trust client x-forwarded-for.
    const ip = requestHeaders.get('x-vercel-forwarded-for')?.trim();
    if (!ip || !isIP(ip)) return unavailable;
    const hash = (value: string) =>
      createHmac('sha256', config.hashKey).update(value).digest('hex');
    const { data, error } = await intakeDatabase(config).rpc('submit_demo_request', {
      p_name: parsed.data.name,
      p_email: parsed.data.email,
      p_company: parsed.data.company,
      p_message: parsed.data.message,
      p_ip_hash: hash(`ip:${ip}`),
      p_email_hash: hash(`email:${parsed.data.email}`),
    });
    if (error || data !== true) return unavailable;
    return {
      success: true,
      message:
        'Your request was saved for Manuel Rodriguez to review. No automatic email confirmation has been sent.',
    };
  } catch {
    // Do not log contact details, request headers, database errors or service credentials.
    return unavailable;
  }
}
