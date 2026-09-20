import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { connectDatabase } from './db.mjs';
assert.equal(process.argv[2], 'enable-ges');
assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'bcrxejydosltquspsutw');
assert(!process.env.BIDXCHANGE_TEST_DATABASE_URL);
const org = '7f459940-4240-439f-9b84-a2e92365cde6';
const db = await connectDatabase();
try {
  assert(
    db.connectionParameters.host === 'db.bcrxejydosltquspsutw.supabase.co' ||
      db.connectionParameters.user.endsWith('.bcrxejydosltquspsutw'),
  );
  await db.query('begin');
  const target = (
    await db.query(
      'select operating_name,status from public.organizations where id=$1 for update',
      [org],
    )
  ).rows[0];
  assert.equal(target.operating_name, 'Green Energy Solutions');
  assert.notEqual(target.status, 'suspended');
  await db.query(
    'insert into public.ai_organization_settings(organization_id,enabled,daily_org_limit,daily_user_limit) values($1,true,50,10) on conflict(organization_id) do update set enabled=true,daily_org_limit=50,daily_user_limit=10,updated_at=now()',
    [org],
  );
  const result = (
    await db.query(
      'select enabled,daily_org_limit,daily_user_limit from public.ai_organization_settings where organization_id=$1',
      [org],
    )
  ).rows[0];
  assert.deepEqual(result, { enabled: true, daily_org_limit: 50, daily_user_limit: 10 });
  await db.query('commit');
  console.log(JSON.stringify({ workspace: 'Green Energy Solutions', ...result }));
} catch (error) {
  await db.query('rollback').catch(() => {});
  console.error('AI activation failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await db.end();
}
