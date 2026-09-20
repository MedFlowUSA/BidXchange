import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { connectDatabase } from './db.mjs';
import { stagingDatabase } from './staging/connection.mjs';
import { validateMigrations } from './staging/prepare.mjs';

// Production application requires a separately approved named migration release.
const mode = process.argv[2];
assert(['migrate-staging', 'migrate-production'].includes(mode));
const production = mode === 'migrate-production';
if (production) {
  assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'bcrxejydosltquspsutw');
  assert(!process.env.BIDXCHANGE_TEST_DATABASE_URL);
}
const migrations = validateMigrations('supabase/migrations').filter((item) =>
  [
    '20260919000700_evidence_use_reviews.sql',
    '20260919000800_evidence_review_grants.sql',
    '20260919000900_evidence_review_conflict.sql',
  ].includes(item.file),
);
assert.equal(migrations.length, 3);
const db = production ? await connectDatabase() : await stagingDatabase();
try {
  if (production)
    assert(
      db.connectionParameters.host === 'db.bcrxejydosltquspsutw.supabase.co' ||
        db.connectionParameters.user.endsWith('.bcrxejydosltquspsutw'),
    );
  await db.query('begin');
  await db.query("set local lock_timeout='5s'; set local statement_timeout='30s'");
  for (const migration of migrations) {
    const version = migration.file.slice(0, 14),
      name = migration.file.slice(15, -4);
    const prior = await db.query(
      'select statements from supabase_migrations.schema_migrations where version=$1',
      [version],
    );
    if (prior.rowCount) assert.equal(prior.rows[0].statements.join('\n'), migration.sql);
    else {
      await db.query(migration.sql);
      await db.query(
        'insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',
        [version, name, [migration.sql]],
      );
    }
  }
  const checks = await db.query(`select
    (select relrowsecurity from pg_class where oid='public.evidence_use_reviews'::regclass) as rls,
    has_table_privilege('authenticated','public.current_evidence_use_reviews','SELECT') as can_read,
    has_table_privilege('authenticated','public.current_evidence_use_reviews','UPDATE') as can_update,
    has_table_privilege('anon','public.evidence_use_reviews','SELECT') as anon_read,
    has_column_privilege('authenticated','public.evidence_use_reviews','reviewed_by','INSERT') as forge_actor`);
  assert.deepEqual(checks.rows[0], {
    rls: true,
    can_read: true,
    can_update: false,
    anon_read: false,
    forge_actor: false,
  });
  await db.query('commit');
  console.log(
    JSON.stringify({
      target: production ? 'production' : 'staging',
      migrations: ['007', '008', '009'],
      installed: true,
      permissionChecksPassed: true,
    }),
  );
} catch (error) {
  await db.query('rollback').catch(() => {});
  console.error('Evidence review migration failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await db.end();
}
