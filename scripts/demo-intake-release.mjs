import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { connectDatabase } from './db.mjs';
import { stagingDatabase } from './staging/connection.mjs';
import { validateMigrations } from './staging/prepare.mjs';

const mode = process.argv[2];
assert(['inspect-production', 'migrate-staging', 'migrate-production'].includes(mode));
const production = mode !== 'migrate-staging';
if (production) {
  assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'bcrxejydosltquspsutw');
  assert(!process.env.BIDXCHANGE_TEST_DATABASE_URL);
}
const db = production ? await connectDatabase() : await stagingDatabase();
try {
  if (production)
    assert(
      db.connectionParameters.host === 'db.bcrxejydosltquspsutw.supabase.co' ||
        db.connectionParameters.user.endsWith('.bcrxejydosltquspsutw'),
    );
  if (mode !== 'inspect-production') {
    const migration = validateMigrations('supabase/migrations').find(
      (item) => item.file === '20260919000600_demo_intake.sql',
    );
    assert(migration);
    await db.query('begin');
    await db.query("set local lock_timeout='5s'; set local statement_timeout='30s'");
    const prior = await db.query(
      "select version from supabase_migrations.schema_migrations where version='20260919000600'",
    );
    if (!prior.rowCount) {
      await db.query(migration.sql);
      await db.query(
        'insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',
        ['20260919000600', 'demo_intake', [migration.sql]],
      );
    }
    await db.query('commit');
    console.log(
      JSON.stringify({
        target: production ? 'production' : 'staging',
        migration: '006',
        installed: true,
      }),
    );
  }
  if (production) {
    const accounts = await db.query(
      "select id,email_confirmed_at is not null as verified,(banned_until is null or banned_until<now()) as allowed from auth.users where lower(email)='mrodriguez@oaisinc.com' and deleted_at is null",
    );
    console.log(
      JSON.stringify({
        businessAccountCount: accounts.rowCount,
        verifiedAccountAvailable:
          accounts.rows.length === 1 && accounts.rows[0].verified && accounts.rows[0].allowed,
      }),
    );
    if (
      mode === 'migrate-production' &&
      accounts.rows.length === 1 &&
      accounts.rows[0].verified &&
      accounts.rows[0].allowed
    ) {
      await db.query(
        'insert into private.demo_operators(user_id) values($1) on conflict do nothing',
        [accounts.rows[0].id],
      );
      console.log('Verified business account enrolled for demo requests only.');
    }
    const ai = await db.query(
      'select count(*)::int n from public.ai_organization_settings where enabled',
    );
    console.log(JSON.stringify({ enabledAiOrganizations: ai.rows[0].n }));
  }
} catch (error) {
  await db.query('rollback').catch(() => {});
  console.error('Intake release check failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await db.end();
}
