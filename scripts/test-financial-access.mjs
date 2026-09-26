import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { localTestDatabase } from './local-test-db.mjs';
import { stagingDatabase } from './staging/connection.mjs';

test('raw financial facts and reminders stay administrator-only across organizations', async () => {
  const hosted = process.argv.includes('--staging');
  const db = hosted
    ? await stagingDatabase()
    : await localTestDatabase({ includeCompanySeed: false });
  if (!hosted) {
    const dependencies = readFileSync('scripts/test-evidence-monitor.mjs', 'utf8').split(
      '  const admin =',
    )[0];
    for (const match of dependencies.matchAll(/'(\d{14}_[a-z_]+\.sql)'/g))
      await db.query(readFileSync('supabase/migrations/' + match[1], 'utf8'));
    await db.query(
      readFileSync('supabase/migrations/20260926003300_financial_passport_access.sql', 'utf8'),
    );
  }
  await db.query('begin');
  try {
    const org = randomUUID(),
      other = randomUUID(),
      profile = randomUUID(),
      financial = randomUUID(),
      license = randomUUID();
    await db.query(
      "insert into public.organizations(id,legal_name,operating_name,slug) values($1::uuid,'Synthetic access test','Synthetic access test',$1::text),($2::uuid,'Other synthetic company','Other synthetic company',$2::text)",
      [org, other],
    );
    await db.query('insert into public.company_profiles(id,organization_id) values($1,$2)', [
      profile,
      org,
    ]);
    const roles = [
      'organization_admin',
      'executive_approver',
      'estimator',
      'capture_manager',
      'contributor',
      'viewer',
    ];
    const users = roles.map(() => randomUUID());
    for (let i = 0; i < roles.length; i++) {
      await db.query('insert into auth.users(id) values($1)', [users[i]]);
      await db.query(
        'insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,$3)',
        [org, users[i], roles[i]],
      );
    }
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin')",
      [other, users[2]],
    );
    await db.query(
      "insert into public.profile_facts(id,organization_id,company_profile_id,fact_type,label,value,sensitivity,expiration_date,owner_user_id) values($1,$3,$4,'financial','Synthetic capacity','PRIVATE TEST VALUE','workspace',current_date-1,$5),($2,$3,$4,'license','Synthetic license','DEMO-ONLY','workspace',current_date+30,$5)",
      [financial, license, org, profile, users[2]],
    );
    await db.query('select private.monitor_organization_evidence($1)', [org]);
    const reminder = (
      await db.query(
        'select id,updated_at,assigned_user_id from public.evidence_reminders where organization_id=$1 and fact_id=$2',
        [org, financial],
      )
    ).rows[0];
    assert.equal(
      reminder.assigned_user_id,
      users[0],
      'financial reminder assigned to admin, not estimator owner',
    );
    for (let i = 0; i < roles.length; i++) {
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [users[i]]);
      await db.query('set local role authenticated');
      const facts = (
        await db.query('select id,value from public.profile_facts where organization_id=$1', [org])
      ).rows;
      assert.equal(
        facts.some((f) => f.id === financial),
        i === 0,
        roles[i] + ' raw financial visibility',
      );
      assert(
        facts.some((f) => f.id === license),
        'nonfinancial workspace evidence preserved',
      );
      assert.equal(
        (await db.query('select id from public.evidence_reminders where id=$1', [reminder.id])).rows
          .length,
        i === 0 ? 1 : 0,
      );
      if (i !== 0) {
        await db.query('savepoint denied');
        await assert.rejects(
          () =>
            db.query('select public.acknowledge_evidence_reminder($1,$2,$3)', [
              org,
              reminder.id,
              reminder.updated_at,
            ]),
          /Source access required/,
        );
        await db.query('rollback to savepoint denied');
      }
      await db.query('set local role postgres');
    }
    // Removing membership cannot borrow administrator authority from another workspace.
    await db.query(
      "update public.organization_memberships set status='suspended' where organization_id=$1 and user_id=$2",
      [org, users[2]],
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [users[2]]);
    await db.query('set local role authenticated');
    assert.equal(
      (await db.query('select id from public.profile_facts where organization_id=$1', [org])).rows
        .length,
      0,
    );
  } finally {
    await db.query('rollback');
    await db.end();
  }
});
