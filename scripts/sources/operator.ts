import pg from 'pg';
async function main() {
  const command = process.argv[2];
  if (
    !['status', 'enable', 'disable', 'prune-runs'].includes(command) ||
    !process.env.BIDXCHANGE_SOURCE_DATABASE_URL
  ) {
    console.log(
      'Usage: npx tsx scripts/sources/operator.ts status|enable|disable|prune-runs. Requires private explicit BIDXCHANGE_SOURCE_DATABASE_URL.',
    );
    process.exit(1);
  }
  if (command !== 'status' && !process.argv.includes('--approved-change')) {
    console.log(
      'State changes require --approved-change and approval for the selected environment.',
    );
    process.exit(1);
  }
  const db = new pg.Client({
    connectionString: process.env.BIDXCHANGE_SOURCE_DATABASE_URL,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
  });
  try {
    await db.connect();
    if (command === 'status') {
      const source = await db.query(
        'select id,enabled,last_attempt,last_success,last_status from public.procurement_sources',
      );
      const runs = await db.query(
        'select id,started_at,finished_at,status,pages,received,created,updated,unchanged,failed,error_code from public.source_sync_runs order by started_at desc limit 10',
      );
      console.log(JSON.stringify({ sources: source.rows, runs: runs.rows }, null, 2));
    } else {
      await db.query('begin');
      await db.query('select pg_advisory_xact_lock(1396788551)');
      if (command === 'prune-runs') {
        await db.query(
          "delete from public.source_sync_items where run_id in(select id from public.source_sync_runs where finished_at<now()-interval '90 days')",
        );
        await db.query(
          "delete from public.source_sync_runs where finished_at<now()-interval '90 days'",
        );
      } else {
        await db.query("update public.procurement_sources set enabled=$1 where id='sam.gov'", [
          command === 'enable',
        ]);
        await db.query(
          "insert into public.source_operator_events(source_id,action) values('sam.gov',$1)",
          [command],
        );
      }
      await db.query('commit');
      console.log('Operator change completed.');
    }
  } catch {
    await db.query('rollback').catch(() => {});
    console.log('Operator command failed; no credentials or database error details emitted.');
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
main().catch(() => {
  console.error('Operator configuration failed.');
  process.exitCode = 1;
});
