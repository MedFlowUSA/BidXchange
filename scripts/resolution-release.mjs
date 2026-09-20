import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { connectDatabase } from './db.mjs';
import { stagingDatabase } from './staging/connection.mjs';
import { validateMigrations } from './staging/prepare.mjs';
const mode = process.argv[2];
assert(['migrate-staging', 'migrate-production'].includes(mode));
const production = mode === 'migrate-production';
if (production) {
  assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'bcrxejydosltquspsutw');
  assert(!process.env.BIDXCHANGE_TEST_DATABASE_URL);
}
const migration = validateMigrations('supabase/migrations').find(
  (m) => m.file === '20260920001100_requirement_resolutions.sql',
);
assert(migration);
const db = production ? await connectDatabase() : await stagingDatabase();
try {
  if (production)
    assert(
      db.connectionParameters.host === 'db.bcrxejydosltquspsutw.supabase.co' ||
        db.connectionParameters.user.endsWith('.bcrxejydosltquspsutw'),
    );
  await db.query('begin');
  await db.query("set local lock_timeout='5s'; set local statement_timeout='30s'");
  const prior = await db.query(
    "select statements from supabase_migrations.schema_migrations where version='20260920001100'",
  );
  if (prior.rowCount) assert.equal(prior.rows[0].statements.join('\n'), migration.sql);
  else {
    await db.query(migration.sql);
    await db.query(
      'insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',
      ['20260920001100', 'requirement_resolutions', [migration.sql]],
    );
  }
  const permissions = (
    await db.query(
      "select has_table_privilege('anon','public.current_requirement_resolutions','SELECT') anon_read,has_column_privilege('authenticated','public.requirement_resolution_history','evidence_review_id','SELECT') private_link,has_table_privilege('authenticated','public.requirement_resolution_history','INSERT') direct_write,has_table_privilege('authenticated','public.current_requirement_resolutions','SELECT') summary_read",
    )
  ).rows[0];
  assert.deepEqual(permissions, {
    anon_read: false,
    private_link: false,
    direct_write: false,
    summary_read: true,
  });
  await db.query('commit');
  console.log(
    JSON.stringify({
      target: production ? 'production' : 'staging',
      migration: '011',
      installed: true,
      checksumVerified: true,
      permissionChecksPassed: true,
    }),
  );
} catch (error) {
  await db.query('rollback').catch(() => {});
  console.error('Resolution release failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await db.end();
}
