import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { stagingKeys } from './connection.mjs';
const values = {
  SUPABASE_SERVICE_ROLE_KEY: stagingKeys().service,
  BIDXCHANGE_INTAKE_HASH_KEY: randomBytes(32).toString('hex'),
  BIDXCHANGE_DEMO_INTAKE_ENABLED: 'true',
};
for (const [name, value] of Object.entries(values)) {
  try {
    execFileSync(
      'cmd.exe',
      [
        '/d',
        '/s',
        '/c',
        `npx --yes vercel env add ${name} preview --git-branch staging --sensitive --yes`,
      ],
      { input: value, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    console.log(`Configured staging ${name}`);
  } catch {
    throw new Error(
      `Staging configuration failed for ${name}; existing secrets were not overwritten.`,
    );
  }
}
