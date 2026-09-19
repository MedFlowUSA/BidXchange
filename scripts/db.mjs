import pg from 'pg';
import { execFileSync } from 'node:child_process';

// Credentials stay in memory. Never print the CLI dry-run output or connection string.
export async function connectDatabase() {
  let config;
  if (process.env.BIDXCHANGE_TEST_DATABASE_URL) {
    config = { connectionString: process.env.BIDXCHANGE_TEST_DATABASE_URL };
  } else {
    const plan = execFileSync('supabase', ['db', 'dump', '--linked', '--dry-run'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const values = Object.fromEntries(
      [...plan.matchAll(/^export (PG\w+)="([^"]*)"/gm)].map((m) => [m[1], m[2]]),
    );
    if (!values.PGHOST || !values.PGPASSWORD)
      throw new Error('Linked database credentials unavailable. Set BIDXCHANGE_TEST_DATABASE_URL.');
    config = {
      host: values.PGHOST,
      port: Number(values.PGPORT),
      user: values.PGUSER,
      password: values.PGPASSWORD,
      database: values.PGDATABASE,
      ssl: { rejectUnauthorized: true },
    };
  }
  const client = new pg.Client({ ...config, connectionTimeoutMillis: 15000 });
  await client.connect();
  if (!process.env.BIDXCHANGE_TEST_DATABASE_URL) await client.query('set role postgres');
  return client;
}
