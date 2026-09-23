import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readdirSync,
  readFileSync,
} from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { manifest, preparePackage, validateMigrations } from './prepare.mjs';

function fixture() {
  mkdirSync('.tmp', { recursive: true });
  const root = mkdtempSync(path.resolve('.tmp/staging-prepare-test-'));
  const migrations = path.join(root, 'supabase/migrations');
  mkdirSync(migrations, { recursive: true });
  for (const { file } of manifest.migrations)
    copyFileSync('supabase/migrations/' + file, path.join(migrations, file));
  return { root, migrations };
}

test('only reviewed schema files enter an unlinked idempotent package', () => {
  const { root } = fixture();
  const result = preparePackage(root);
  assert.equal(result.included.length, 29);
  assert.deepEqual(result.excluded, ['20260919000200_ges_onboarding.sql']);
  assert.deepEqual(preparePackage(root), result);
  assert.equal(readdirSync(path.join(result.destination, 'migrations')).length, 29);
  assert.deepEqual(readdirSync(result.destination).sort(), [
    'README.txt',
    'manifest.json',
    'migrations',
  ]);
  for (const file of result.included)
    assert(
      !readFileSync(path.join(result.destination, 'migrations', file), 'utf8').includes(
        'gesfree.com',
      ),
    );
});

test('checksum changes and new migration files stop preparation', () => {
  const { root, migrations } = fixture();
  writeFileSync(path.join(migrations, manifest.migrations[0].file), '-- tampered');
  assert.throws(() => preparePackage(root), /checksum changed/);
  const other = fixture();
  writeFileSync(path.join(other.migrations, '20260920000100_unreviewed.sql'), 'select 1;');
  assert.throws(() => preparePackage(other.root), /Unreviewed migration inventory/);
});

test('missing excluded seed is not silently accepted as verified history', () => {
  const { migrations } = fixture();
  assert.throws(
    () =>
      validateMigrations(migrations, {
        ...manifest,
        migrations: manifest.migrations.filter((m) => m.action !== 'exclude-data-seed'),
      }),
    /inventory/,
  );
});

test('existing linkage and altered output are refused', () => {
  const first = fixture();
  const out = preparePackage(first.root).destination;
  mkdirSync(path.join(out, '.temp'));
  writeFileSync(path.join(out, '.temp/project-ref'), 'bcrxejydosltquspsutw');
  assert.throws(() => preparePackage(first.root), /linkage/);
  const second = fixture();
  const altered = preparePackage(second.root).destination;
  writeFileSync(path.join(altered, 'manifest.json'), '{}');
  assert.throws(() => preparePackage(second.root), /Existing package changed/);
});

test('schema-only bootstrap has tenant protections and no company or AI activation rows', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to authenticated,anon;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
    for (const { sql } of validateMigrations('supabase/migrations')) await db.exec(sql);
    for (const table of [
      'organizations',
      'organization_memberships',
      'profile_facts',
      'ai_organization_settings',
      'ai_usage_events',
      'demo_requests',
      'source_records',
      'source_inbox',
      'opportunity_searches',
    ])
      assert.equal((await db.query(`select count(*)::int n from public.${table}`)).rows[0].n, 0);
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
        )
      ).rows[0].n,
      0,
    );
    for (const table of [
      'requirements_register_signoffs',
      'opportunity_amendments',
      'profile_facts',
      'pursuit_decision_history',
    ])
      assert.ok(
        (
          await db.query(
            "select count(*)::int n from pg_policies where schemaname='public' and tablename=$1",
            [table],
          )
        ).rows[0].n > 0,
      );
    assert.equal(
      (
        await db.query(
          "select has_table_privilege('authenticated','public.organizations','TRUNCATE') allowed",
        )
      ).rows[0].allowed,
      false,
    );
    assert.equal(
      (
        await db.query(
          "select has_column_privilege('authenticated','public.ai_usage_events','prompt_digest','SELECT') allowed",
        )
      ).rows[0].allowed,
      false,
    );
    assert.equal(
      (await db.query("select public from storage.buckets where id='company-private'")).rows[0]
        .public,
      false,
    );
  } finally {
    await db.close();
  }
});
