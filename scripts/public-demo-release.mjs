import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { connectDatabase } from './db.mjs';
import { stagingDatabase } from './staging/connection.mjs';
const mode = process.argv[2];
assert(['staging', 'production', 'enable-production'].includes(mode));
if (mode !== 'staging') {
  assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'bcrxejydosltquspsutw');
  assert(!process.env.BIDXCHANGE_TEST_DATABASE_URL);
}
const db = mode === 'staging' ? await stagingDatabase() : await connectDatabase();
try {
  if (mode !== 'staging')
    assert(
      db.connectionParameters.host === 'db.bcrxejydosltquspsutw.supabase.co' ||
        db.connectionParameters.user.endsWith('.bcrxejydosltquspsutw'),
    );
  await db.query('begin');
  await db.query("set local lock_timeout='5s';set local statement_timeout='30s'");
  const sql = readFileSync('supabase/migrations/20260920001400_public_demo_ai.sql', 'utf8').replace(
    /\r\n/g,
    '\n',
  );
  const prior = await db.query(
    "select statements from supabase_migrations.schema_migrations where version='20260920001400'",
  );
  if (prior.rows.length) assert.equal(prior.rows[0].statements.join('\n'), sql);
  else {
    assert.notEqual(mode, 'enable-production');
    await db.query(sql);
    await db.query(
      'insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',
      ['20260920001400', 'public_demo_ai', [sql]],
    );
  }
  const checks = (
    await db.query(
      "select has_table_privilege('anon','public.demo_ai_usage','SELECT') as anonymous_read,has_function_privilege('authenticated','public.reserve_demo_ai(uuid,text,text)','EXECUTE') as user_execute,has_function_privilege('service_role','public.reserve_demo_ai(uuid,text,text)','EXECUTE') as server_execute",
    )
  ).rows[0];
  assert.deepEqual(checks, { anonymous_read: false, user_execute: false, server_execute: true });
  if (mode === 'enable-production')
    await db.query('update public.demo_ai_settings set enabled=true where id');
  await db.query('commit');
  console.log(
    JSON.stringify({
      mode,
      migration: '014',
      permissionsVerified: true,
      enabled: mode === 'enable-production',
    }),
  );
} catch (e) {
  await db.query('rollback');
  console.error('Public demo release failed:', e.code ?? e.name);
  process.exitCode = 1;
} finally {
  await db.end();
}
