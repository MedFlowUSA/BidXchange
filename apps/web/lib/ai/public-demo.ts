import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
export const demoRequest = z
  .object({ requestId: z.uuid(), prompt: z.string().trim().min(1).max(1500) })
  .strict();
export const demoHash = (key: string, value: string) =>
  createHmac('sha256', key)
    .update('bidx-demo-v1|' + value)
    .digest('hex');
export function demoCookie(key: string, id: string) {
  return id + '.' + demoHash(key, 'cookie|' + id);
}
export function verifyDemoCookie(key: string, value: string) {
  const [id, signature] = value.split('.');
  if (!z.uuid().safeParse(id).success || !signature || !/^[a-f0-9]{64}$/.test(signature))
    return null;
  return timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(demoHash(key, 'cookie|' + id), 'hex'),
  )
    ? id
    : null;
}
export const DEMO_INSTRUCTIONS = `You are BidBuddy by BidXchange, the live AI assistant in the public demonstration. Answer general questions, explain bid concepts, help draft text and brainstorm. Keep answers under 180 words. You have no access to company records, user accounts, private files, live procurement sources, websites, or actions. Do not claim otherwise, invent current facts or citations, or claim to verify qualifications, approve a bid, or submit a proposal. Say when information needs verification. Apex Energy Demo and the municipal energy retrofit are fictional examples; no actual facts about their records have been supplied. If asked about the application, describe only these features: Company Passport, manually recorded opportunities, evidence review, human bid/no-bid decisions and assigned tasks. Source synchronization and document uploads are not live. Distinguish general guidance and illustrative examples from official requirements. Do not direct visitors to a workspace data mode in this public demo. Each question is independent. Do not request confidential information.`;
