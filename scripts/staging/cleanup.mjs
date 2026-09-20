import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { stagingDatabase, stagingKeys, stagingRef } from './connection.mjs';

export async function cleanupFixtures(db, operator, manifest) {
  assert.equal(manifest.project, stagingRef);
  for (const id of manifest.organizations) {
    const rows = (await db.query('select slug from public.organizations where id=$1', [id])).rows;
    assert(
      !rows.length || rows[0].slug === `staging-test-${id}`,
      'Cleanup requires a recorded synthetic organization',
    );
  }
  const retained = (
    await db.query(
      "select organization_id,user_id from public.organization_memberships where organization_id=any($1::uuid[]) and role='organization_admin' and status='active'",
      [manifest.organizations],
    )
  ).rows;
  const retainedOrgs = [...new Set(retained.map((r) => r.organization_id))];
  const retainedUsers = [...new Set(retained.map((r) => r.user_id))];
  assert(
    retainedUsers.every((id) => manifest.users.includes(id)),
    'Cleanup contains an unrecorded administrator',
  );
  // No trigger or policy is disabled. Last-admin protection deliberately retains an inert shell.
  await db.query('begin');
  try {
    const tables = (
      await db.query(
        "select table_name from information_schema.columns where table_schema='public' and column_name='organization_id' order by case when table_name like 'pursuit_%' or table_name in ('proposal_sections','submission_records') then 0 when table_name='pursuits' then 1 when table_name='profile_facts' then 3 when table_name='company_profiles' then 4 when table_name='organization_memberships' then 5 when table_name='audit_events' then 6 else 2 end",
      )
    ).rows;
    for (const { table_name } of tables) {
      assert.match(table_name, /^[a-z_]+$/);
      const exclude =
        table_name === 'organization_memberships'
          ? " and not(role='organization_admin' and status='active')"
          : '';
      await db.query(
        `delete from public.${table_name} where organization_id=any($1::uuid[])${exclude}`,
        [manifest.organizations],
      );
    }
    await db.query("update public.organizations set status='suspended' where id=any($1::uuid[])", [
      retainedOrgs,
    ]);
    await db.query(
      'delete from public.organizations where id=any($1::uuid[]) and not(id=any($2::uuid[]))',
      [manifest.organizations, retainedOrgs],
    );
    await db.query('delete from private.admin_mutation_limits where user_id=any($1::uuid[])', [
      manifest.users,
    ]);
    await db.query('commit');
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
  for (const id of manifest.users) {
    const result = retainedUsers.includes(id)
      ? await operator.auth.admin.updateUserById(id, { ban_duration: '876000h' })
      : await operator.auth.admin.deleteUser(id);
    if (result.error) throw new Error('Synthetic auth cleanup failed');
  }
  manifest.cleaned = retained.length === 0;
  manifest.quarantined = retained;
  return {
    removed: manifest.cleaned,
    quarantinedOrganizations: retainedOrgs.length,
    bannedUsers: retainedUsers.length,
  };
}

if (process.argv.includes('--recorded')) {
  const file = '.tmp/staging-fixtures.json',
    manifest = JSON.parse(readFileSync(file, 'utf8'));
  const db = await stagingDatabase(),
    keys = stagingKeys();
  try {
    const result = await cleanupFixtures(
      db,
      createClient(`https://${stagingRef}.supabase.co`, keys.service, {
        auth: { persistSession: false },
      }),
      manifest,
    );
    writeFileSync(file, JSON.stringify(manifest, null, 2));
    writeFileSync(
      `.tmp/staging-quarantine-${manifest.organizations[0]}.json`,
      JSON.stringify(manifest, null, 2),
    );
    console.log(JSON.stringify(result));
  } finally {
    await db.end();
  }
}
