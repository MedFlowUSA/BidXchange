import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { connectDatabase } from './db.mjs';
import { stagingDatabase } from './staging/connection.mjs';

const [target, action = 'status'] = process.argv.slice(2);
assert(['production', 'staging'].includes(target));
assert(['enable', 'disable', 'status', 'run'].includes(action));
const name = 'bidxchange-evidence-monitor';
const command =
  "set lock_timeout='5s'; set statement_timeout='120s'; select private.run_evidence_monitor(25);";
let db;
try {
  if (target === 'production') {
    assert(!process.env.BIDXCHANGE_TEST_DATABASE_URL);
    assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'bcrxejydosltquspsutw');
    db = await connectDatabase();
  } else db = await stagingDatabase();
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from supabase_migrations.schema_migrations where version='20260922002800'",
      )
    ).rows[0].n,
    1,
  );
  if (action === 'enable')
    await db.query('create extension if not exists pg_cron with schema pg_catalog');
  const installed = (await db.query("select 1 from pg_extension where extname='pg_cron'")).rowCount;
  if (!installed) {
    console.log(JSON.stringify({ target, installed: false }));
  } else {
    const existing = (
      await db.query('select jobid, command, username from cron.job where jobname=$1', [name])
    ).rows[0];
    if (existing) {
      assert.equal(existing.command, command, 'Unexpected existing job command');
      assert.equal(existing.username, 'postgres', 'Unexpected job owner');
    }
    if (action === 'enable')
      await db.query("select cron.schedule($1, '*/15 * * * *', $2)", [name, command]);
    if (action === 'disable' && existing)
      await db.query('select cron.unschedule($1::bigint)', [existing.jobid]);
    if (action === 'run') await db.query(command);
    const jobs = (
      await db.query('select jobid, schedule, active from cron.job where jobname=$1', [name])
    ).rows;
    const runs = (
      await db.query(
        'select status, start_time, end_time from cron.job_run_details where jobid in (select jobid from cron.job where jobname=$1) order by start_time desc limit 3',
        [name],
      )
    ).rows;
    const health = (
      await db.query(
        'select count(*)::int organizations, count(last_success_at)::int checked, count(*) filter(where last_error_code is not null)::int failed from private.evidence_monitor_state',
      )
    ).rows[0];
    console.log(JSON.stringify({ target, installed: true, jobs, runs, health }));
  }
} catch (error) {
  const code =
    typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'UNAVAILABLE';
  console.error(`Evidence scheduler ${action} failed (${code}); provider details withheld.`);
  process.exitCode = 1;
} finally {
  await db?.end();
}
