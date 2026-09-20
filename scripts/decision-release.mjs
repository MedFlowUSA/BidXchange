import assert from 'node:assert/strict';
import { stagingDatabase } from './staging/connection.mjs';
import { validateMigrations } from './staging/prepare.mjs';

// Production application requires a separately approved named migration release.
const mode = process.argv[2];
assert.equal(mode, 'migrate-staging');
const migrations = validateMigrations('supabase/migrations').filter(
  (m) => m.file === '20260920001000_pursuit_decisions.sql',
);
assert.equal(migrations.length, 1);
const db = await stagingDatabase();
try {
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
  await db.query('commit');
  console.log(
    JSON.stringify({
      target: 'staging',
      migrations: ['010'],
      installed: true,
      checksumVerified: true,
    }),
  );
} catch (error) {
  await db.query('rollback').catch(() => {});
  console.error('Decision migration failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await db.end();
}
