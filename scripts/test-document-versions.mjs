import test from 'node:test';
import assert from 'node:assert/strict';
import { localTestDatabase } from './local-test-db.mjs';
import { validateMigrations } from './staging/prepare.mjs';
test('document versions enforce tenant scope, immutable metadata, scan authority and versioned references', async () => {
  const db = await localTestDatabase({ includeCompanySeed: false });
  try {
    await db.query('create role service_role bypassrls');
    for (const migration of validateMigrations('supabase/migrations').filter(
      (m) => m.file > '20260919000499',
    )) {
      if (migration.file.includes('01200'))
        await db.query(
          'alter default privileges in schema public grant all on tables to anon,authenticated',
        );
      await db.query(migration.sql);
    }
    const users = [
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
      'a0000000-0000-4000-8000-000000000003',
    ];
    for (const user of users) await db.query('insert into auth.users(id) values($1)', [user]);
    const org = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Synthetic','Synthetic','document-test') returning id",
      )
    ).rows[0].id;
    const foreign = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Foreign','Foreign','document-foreign') returning id",
      )
    ).rows[0].id;
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin'),($1,$3,'viewer'),($4,$5,'organization_admin')",
      [org, users[0], users[1], foreign, users[2]],
    );
    async function as(user, sql, args = [], role = 'authenticated') {
      await db.query(`set role ${role}`);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
      try {
        return await db.query(sql, args);
      } finally {
        await db.query('reset role');
      }
    }
    const reserve = 'select public.reserve_document_version($1,$2,$3,$4,$5) id';
    const hash = 'a'.repeat(64),
      args = [org, null, 'License', hash, 100];
    await assert.rejects(as(users[1], reserve, args));
    await assert.rejects(as(users[2], reserve, args));
    const first = (await as(users[0], reserve, args)).rows[0].id;
    const row = (await as(users[0], 'select * from public.document_versions')).rows[0];
    assert.equal(row.scan_status, 'pending');
    const second = (await as(users[0], reserve, [org, row.document_id, 'Ignored', hash, 100]))
      .rows[0].id;
    assert.equal(
      (await db.query('select version from public.document_versions where id=$1', [second])).rows[0]
        .version,
      2,
    );
    assert.equal((await as(users[1], 'select * from public.document_versions')).rows.length, 0);
    assert.equal((await as(users[2], 'select * from public.document_libraries')).rows.length, 0);
    await assert.rejects(
      as(users[0], "update public.document_versions set scan_status='clean' where id=$1", [first]),
    );
    await assert.rejects(as(users[0], 'delete from public.document_versions where id=$1', [first]));
    const scan = 'select public.finish_document_scan($1,$2,$3,$4) ok';
    await assert.rejects(as(users[0], scan, [first, hash, 'clean', 'Synthetic scanner']));
    assert.equal(
      (await as(users[0], scan, [first, hash, 'clean', 'Synthetic scanner'], 'service_role'))
        .rows[0].ok,
      false,
    );
    await as(
      users[0],
      'select public.confirm_document_upload($1,$2)',
      [first, hash],
      'service_role',
    );
    assert.equal(
      (
        await as(
          users[0],
          scan,
          [first, 'b'.repeat(64), 'clean', 'Synthetic scanner'],
          'service_role',
        )
      ).rows[0].ok,
      false,
    );
    assert.equal(
      (await as(users[0], scan, [first, hash, 'clean', 'Synthetic scanner'], 'service_role'))
        .rows[0].ok,
      true,
    );
    assert.equal(
      (await as(users[0], scan, [first, hash, 'rejected', 'Synthetic scanner'], 'service_role'))
        .rows[0].ok,
      false,
    );
    const opp = (
      await db.query(
        "insert into public.opportunities(organization_id,title) values($1,'Synthetic') returning id",
        [org],
      )
    ).rows[0].id;
    const pursuit = (
      await db.query(
        "insert into public.pursuits(organization_id,opportunity_id,title) values($1,$2,'Synthetic') returning id",
        [org, opp],
      )
    ).rows[0].id;
    const req = (
      await db.query(
        "insert into public.pursuit_requirements(organization_id,pursuit_id,requirement,citation) values($1,$2,'License','Section 1') returning id,updated_at",
        [org, pursuit],
      )
    ).rows[0];
    const link = 'select public.link_requirement_document($1,$2,$3,$4,$5) id';
    const linkArgs = [org, req.id, req.updated_at, first, 'Page 2'];
    await assert.rejects(as(users[1], link, linkArgs));
    await assert.rejects(as(users[2], link, linkArgs));
    await assert.rejects(as(users[0], link, [org, req.id, req.updated_at, second, 'Page 2']));
    const token = (
      await as(users[0], 'select public.pursuit_decision_context($1,$2) token', [org, pursuit])
    ).rows[0].token;
    await as(users[0], link, linkArgs);
    assert.notEqual(
      (await as(users[0], 'select public.pursuit_decision_context($1,$2) token', [org, pursuit]))
        .rows[0].token,
      token,
    );
    await assert.rejects(as(users[0], link, linkArgs));
    assert.equal(
      (await as(users[1], 'select * from public.requirement_document_links')).rows.length,
      0,
    );
    await db.query(
      "update public.organization_memberships set role='organization_admin' where organization_id=$1 and user_id=$2",
      [org, users[1]],
    );
    await db.query(
      "update public.organization_memberships set status='suspended' where organization_id=$1 and user_id=$2",
      [org, users[0]],
    );
    assert.equal((await as(users[0], 'select * from public.document_versions')).rows.length, 0);
  } finally {
    await db.end();
  }
});
