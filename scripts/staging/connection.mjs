import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
export const stagingRef = 'svimdvbgtltmyaubfaux';
export const stagingWorkdir = '.tmp/staging-operations';
export async function stagingDatabase() {
  assert.equal(
    readFileSync(stagingWorkdir + '/supabase/.temp/project-ref', 'utf8').trim(),
    stagingRef,
  );
  const output = execFileSync(
    'supabase',
    ['db', 'dump', '--linked', '--dry-run', '--workdir', stagingWorkdir],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const values = Object.fromEntries(
    [...output.matchAll(/^export (PG\w+)="([^"]*)"/gm)].map((m) => [m[1], m[2]]),
  );
  assert(
    values.PGHOST === `db.${stagingRef}.supabase.co` || values.PGUSER?.endsWith(`.${stagingRef}`),
    'Wrong database target',
  );
  const client = new pg.Client({
    host: values.PGHOST,
    port: Number(values.PGPORT),
    user: values.PGUSER,
    password: values.PGPASSWORD,
    database: values.PGDATABASE,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  await client.query('set role postgres');
  return client;
}
export function stagingKeys() {
  const keys = JSON.parse(
    execFileSync(
      'supabase',
      ['projects', 'api-keys', '--project-ref', stagingRef, '--output', 'json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ),
  );
  return {
    anon: keys.find((k) => k.name === 'anon').api_key,
    service: keys.find((k) => k.name === 'service_role').api_key,
  };
}
