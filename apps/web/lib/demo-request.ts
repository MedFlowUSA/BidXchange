import { z } from 'zod';

export const demoRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  company: z.string().trim().min(1).max(200),
  message: z.string().trim().max(1500),
  consent: z.literal('yes'),
  website_confirm: z.literal(''),
});

export type DemoRequestState = { message: string; success?: boolean };
