import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stagingKeys, stagingRef } from './connection.mjs';
const root = process.cwd();
const target = path.join(root, '.tmp', 'company-fields-staging');
const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
for (const file of files) {
  if (file.startsWith('.env') || file === '.gitignore' || !existsSync(file)) continue;
  const destination = path.join(target, file);
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(file, destination);
}
const keys = stagingKeys();
const config = path.join(target, 'apps/web/next.config.ts');
writeFileSync(
  config,
  readFileSync(config, 'utf8').replace(
    "path.resolve(__dirname, '../..')",
    "path.resolve(__dirname, '../../../..')",
  ),
);
const env = {
  PATH: process.env.PATH,
  SystemRoot: process.env.SystemRoot,
  TEMP: process.env.TEMP,
  TMP: process.env.TMP,
  NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS,
  SUPABASE_URL: `https://${stagingRef}.supabase.co`,
  SUPABASE_PUBLISHABLE_KEY: keys.anon,
  BIDXCHANGE_STRUCTURED_PROFILES_ENABLED: 'true',
  BIDXCHANGE_RELEASES_ENABLED: 'false',
  BIDXCHANGE_AI_ENABLED: 'false',
  BIDXCHANGE_AI_DEMO_ENABLED: 'false',
  BIDXCHANGE_EVIDENCE_REVIEWS_ENABLED: 'true',
  BIDXCHANGE_RESOLUTIONS_ENABLED: 'true',
  BIDXCHANGE_DECISIONS_ENABLED: 'true',
};
const server = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'dev',
    path.join(target, 'apps/web'),
    '--hostname',
    '127.0.0.1',
    '--port',
    '3103',
  ],
  { env, stdio: 'ignore', windowsHide: true },
);
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch('http://127.0.0.1:3103/login')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!ready) throw new Error('Isolated staging app did not start');
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['scripts/staging/company-fields-browser.mjs', 'http://127.0.0.1:3103'],
      {
        env: { ...process.env, BIDXCHANGE_STAGING_LOCAL: '1' },
        stdio: 'inherit',
        windowsHide: true,
      },
    );
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('Staging browser validation failed')),
    );
  });
} finally {
  server.kill();
}
