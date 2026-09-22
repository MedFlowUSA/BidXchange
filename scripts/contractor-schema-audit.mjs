import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { connectDatabase } from './db.mjs';
import { stagingDatabase, stagingRef } from './staging/connection.mjs';
const target = process.argv[2];
assert(['production', 'staging'].includes(target));
let db;
try {
  if (target === 'production') {
    assert(!process.env.BIDXCHANGE_TEST_DATABASE_URL);
    assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'bcrxejydosltquspsutw');
    db = await connectDatabase();
  } else db = await stagingDatabase();
  await db.query('begin read only');
  await db.query("set local statement_timeout='10s'");
  const versions = (
    await db.query('select version from supabase_migrations.schema_migrations order by version')
  ).rows.map((r) => r.version);
  const missingRls = (
    await db.query(
      "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity order by c.relname",
    )
  ).rows.map((r) => r.relname);
  console.log(
    JSON.stringify({
      target,
      project: target === 'staging' ? stagingRef : 'bcrxejydosltquspsutw',
      versions,
      publicTablesWithoutRls: missingRls,
    }),
  );
  await db.query('rollback');
} catch (error) {
  const code =
    typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'UNAVAILABLE';
  console.error(
    `${target} schema audit unavailable (${code}); credentials and provider details withheld.`,
  );
  process.exitCode = 1;
} finally {
  await db?.end();
}
