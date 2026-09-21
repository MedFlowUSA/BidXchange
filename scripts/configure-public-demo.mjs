import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
// The user explicitly requested public demo AI. Transfer only the required server
// credential through memory/stdin; never export existing OpenAI keys or print values.
assert.equal(process.argv[2], 'configure-production');
assert.equal(
  JSON.parse(readFileSync('.vercel/project.json', 'utf8')).projectId,
  'prj_ioyaaOmsUkVpaVGMwgTqUO1YMHsT',
);
assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'bcrxejydosltquspsutw');
try {
  const keys = JSON.parse(
    execFileSync(
      'supabase',
      ['projects', 'api-keys', '--project-ref', 'bcrxejydosltquspsutw', '--output', 'json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ),
  );
  const key = keys.find((k) => k.name === 'service_role')?.api_key;
  assert(key);
  const cli = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
  for (const [name, value] of [
    ['BIDXCHANGE_DEMO_AI_SERVICE_KEY', key],
    ['BIDXCHANGE_AI_PUBLIC_DEMO_ENABLED', 'true'],
  ]) {
    execFileSync(
      process.execPath,
      [cli, '--yes', 'vercel', 'env', 'add', name, 'production', '--sensitive', '--force', '--yes'],
      { input: value, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  }
  console.log(
    'Public-demo production flag and server credential configured securely. Existing workspace quotas and OpenAI key unchanged. Deployment required.',
  );
} catch {
  console.error('Public-demo configuration failed. No credential values emitted.');
  process.exitCode = 1;
}
