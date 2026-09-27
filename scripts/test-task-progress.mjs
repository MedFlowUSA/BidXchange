import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { localTestDatabase } from './local-test-db.mjs';
import { validateMigrations } from './staging/prepare.mjs';
import { stagingDatabase } from './staging/connection.mjs';

test('assigned task progress is narrow, versioned, audited and tenant isolated', async () => {
  const hosted = process.env.BIDXCHANGE_TASK_PROGRESS_TEST_STAGING === '1';
  pg.types.setTypeParser(1184, (v) => v);
  const db = hosted
    ? await stagingDatabase()
    : await localTestDatabase({ includeCompanySeed: false });
  if (hosted) {
    await db.query('begin');
    const query = db.query.bind(db);
    db.query = async (sql, args) => {
      if (sql === 'rollback') return query(sql);
      await query('savepoint task_progress_test');
      try {
        const r = await query(sql, args);
        await query('release savepoint task_progress_test');
        return r;
      } catch (e) {
        await query('rollback to savepoint task_progress_test');
        await query('release savepoint task_progress_test');
        throw e;
      }
    };
  }
  try {
    if (!hosted) {
      await db.query('create role service_role');
      for (const m of validateMigrations('supabase/migrations').filter(
        (m) => m.file > '20260919000499',
      ))
        await db.query(m.sql);
    }
    const users = Object.fromEntries(
      [
        'organization_admin',
        'capture_manager',
        'executive_approver',
        'estimator',
        'contributor',
        'viewer',
        'foreign',
      ].map((r) => [r, randomUUID()]),
    );
    for (const id of Object.values(users))
      await db.query('insert into auth.users(id) values($1)', [id]);
    async function organization() {
      return (
        await db.query(
          "insert into public.organizations(legal_name,operating_name,slug) values('Fictional task test','Fictional task test',$1) returning id",
          ['task-progress-' + randomUUID()],
        )
      ).rows[0].id;
    }
    const org = await organization(),
      other = await organization();
    for (const [role, id] of Object.entries(users))
      await db.query(
        'insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,$3)',
        [role === 'foreign' ? other : org, id, role === 'foreign' ? 'organization_admin' : role],
      );
    const opportunity = (
      await db.query(
        "insert into public.opportunities(organization_id,title) values($1,'Fictional task opportunity') returning id",
        [org],
      )
    ).rows[0].id;
    const pursuit = (
      await db.query(
        "insert into public.pursuits(organization_id,opportunity_id,title) values($1,$2,'Fictional task pursuit') returning id",
        [org, opportunity],
      )
    ).rows[0].id;
    const requirement = (
      await db.query(
        "insert into public.pursuit_requirements(organization_id,pursuit_id,requirement,citation) values($1,$2,'Ask for bond letter','Fictional notice 4.2') returning *",
        [org, pursuit],
      )
    ).rows[0];
    const beforePursuit = (await db.query('select * from public.pursuits where id=$1', [pursuit]))
      .rows[0];
    async function make(user) {
      return (
        await db.query(
          "insert into public.pursuit_tasks(organization_id,pursuit_id,requirement_id,assigned_user_id,title,priority,notes,due_at,due_timezone) values($1,$2,$3,$4,'Ask the surety','urgent','Keep these instructions',now()+interval '2 days','America/Los_Angeles') returning *",
          [org, pursuit, requirement.id, user],
        )
      ).rows[0];
    }
    async function row(id) {
      return (await db.query('select * from public.pursuit_tasks where id=$1', [id])).rows[0];
    }
    async function as(user, sql, args) {
      await db.query(user ? 'set role authenticated' : 'set role anon');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user ?? '']);
      try {
        return await db.query(sql, args);
      } finally {
        await db.query(hosted ? 'set role postgres' : 'reset role');
      }
    }
    const sql = 'select public.update_pursuit_task_progress($1,$2,$3,$4,$5)';
    const args = (t, status = 'in_progress') => [org, pursuit, t.id, t.updated_at, status];
    for (const role of [
      'organization_admin',
      'capture_manager',
      'executive_approver',
      'estimator',
      'contributor',
    ]) {
      const original = await make(users[role]);
      await as(users[role], sql, args(original));
      const started = await row(original.id);
      assert.equal(started.status, 'in_progress');
      assert.notEqual(started.updated_at, original.updated_at);
      for (const key of Object.keys(original).filter(
        (k) => !['status', 'updated_at', 'completed_at'].includes(k),
      ))
        assert.deepEqual(started[key], original[key], key);
      await assert.rejects(as(users[role], sql, args(original, 'complete')), (error) => {
        assert.equal(
          error.code,
          'P0001',
          'Stale human input must not trigger serialization retries',
        );
        assert.match(error.message, /Task changed/);
        return true;
      });
      await as(users[role], sql, args(started, 'complete'));
      const complete = await row(original.id);
      assert(complete.completed_at);
      await as(users[role], sql, args(complete, 'complete'));
      assert.deepEqual(
        await row(original.id),
        complete,
        'no-op must preserve completion date and version',
      );
      await as(users[role], sql, args(complete, 'todo'));
      assert.equal((await row(original.id)).completed_at, null);
      const events = (
        await db.query(
          "select * from public.audit_events where entity_id=$1 and action='UPDATE' order by created_at,id",
          [original.id],
        )
      ).rows;
      assert.equal(events.length, 3);
      assert(events.every((e) => e.actor_user_id === users[role]));
      assert(
        events.some(
          (e) => e.previous_record.status === 'in_progress' && e.next_record.status === 'complete',
        ),
      );
    }
    const task = await make(users.estimator),
      viewerTask = await make(users.viewer);
    await assert.rejects(as(users.viewer, sql, args(viewerTask)), /Task access/);
    for (const user of [users.contributor, users.foreign, users.organization_admin, null])
      await assert.rejects(as(user, sql, args(task)), /assignment|access|permission/);
    await assert.rejects(
      as(users.estimator, sql, [other, pursuit, task.id, task.updated_at, 'complete']),
      /access/,
    );
    await assert.rejects(
      as(users.estimator, sql, [org, randomUUID(), task.id, task.updated_at, 'complete']),
      /assignment/,
    );
    for (const status of [null, 'approved', 'submitted'])
      await assert.rejects(as(users.estimator, sql, args(task, status)), /Choose a task status/);
    await assert.rejects(
      as(users.estimator, sql, [org, pursuit, task.id, null, 'complete']),
      /Task changed/,
    );
    await as(
      users.estimator,
      "update public.pursuit_tasks set title='Unauthorized',status='complete' where id=$1",
      [task.id],
    );
    assert.deepEqual(await row(task.id), task, 'generic UPDATE must still be denied by RLS');
    await db.query(
      "update public.organization_memberships set status='suspended' where organization_id=$1 and user_id=$2",
      [org, users.estimator],
    );
    await assert.rejects(as(users.estimator, sql, args(task)), /access/);
    await db.query(
      "update public.organization_memberships set status='active' where organization_id=$1 and user_id=$2",
      [org, users.estimator],
    );
    await db.query("update public.organizations set status='suspended' where id=$1", [org]);
    await assert.rejects(as(users.estimator, sql, args(task)), /access/);
    await db.query("update public.organizations set status='active' where id=$1", [org]);
    await db.query('update public.pursuit_tasks set assigned_user_id=$1 where id=$2', [
      users.contributor,
      task.id,
    ]);
    await assert.rejects(as(users.estimator, sql, args(task)), /assignment/);
    await assert.rejects(as(users.contributor, sql, args(task)), /Task changed/);
    await as(users.contributor, sql, args(await row(task.id), 'complete'));
    assert.deepEqual(
      (await db.query('select * from public.pursuit_requirements where id=$1', [requirement.id]))
        .rows[0],
      requirement,
    );
    assert.deepEqual(
      (await db.query('select * from public.pursuits where id=$1', [pursuit])).rows[0],
      beforePursuit,
    );
    console.log(
      'PASS roles, assignment, isolation, stale writes, suspension, reassignment, completion/reopen, immutable fields, no-op, audit actor and unchanged requirement/decision.',
    );
  } finally {
    if (hosted) await db.query('rollback');
    await db.end();
  }
});
