import type { SourceConnector, Snapshot } from '../../apps/web/lib/sources/contracts';
import { matchNotice, searchFilters } from '../../apps/web/lib/sources/contracts';
import { detectChange, normalizeSam, SourceError } from '../../apps/web/lib/sources/sam';

type Database = { query(sql: string, args?: unknown[]): Promise<{ rows: Record<string, any>[] }> }; // eslint-disable-line @typescript-eslint/no-explicit-any
export async function synchronize(
  db: Database,
  connector: SourceConnector,
  options: {
    from: Date;
    to: Date;
    pages: number;
    limit: number;
    secret?: string;
    signal?: AbortSignal;
  },
) {
  const lock = await db.query('select pg_try_advisory_lock(1396788551) as locked');
  if (!lock.rows[0].locked) throw new SourceError('already_running');
  let run: string | undefined;
  const counts = { pages: 0, received: 0, created: 0, updated: 0, unchanged: 0, failed: 0 };
  let errorCode: string | null = null;
  try {
    if (
      !Number.isInteger(options.pages) ||
      options.pages < 1 ||
      options.pages > 10 ||
      !Number.isInteger(options.limit) ||
      options.limit < 1 ||
      options.limit > 100 ||
      options.to < options.from ||
      options.to.getTime() - options.from.getTime() > 31 * 86400000
    )
      throw new SourceError('invalid_run_bounds');
    const enabled = await db.query(
      "select enabled from public.procurement_sources where id='sam.gov'",
    );
    if (!enabled.rows[0]?.enabled) throw new SourceError('disabled');
    // A dedicated session lock, not a TTL, prevents a slow worker overlapping recovery.
    await db.query(
      "update public.source_sync_runs set status='interrupted',finished_at=now(),error_code='worker_interrupted' where status='running'",
    );
    run = (
      await db.query(
        "insert into public.source_sync_runs(source_id,date_from,date_to) values('sam.gov',$1,$2) returning id",
        [options.from.toISOString().slice(0, 10), options.to.toISOString().slice(0, 10)],
      )
    ).rows[0].id;
    await db.query(
      "update public.procurement_sources set last_attempt=now(),last_status='running' where id='sam.gov'",
    );
    let finished = false;
    for (let page = 0; page < options.pages; page++) {
      if (options.signal?.aborted) throw new SourceError('cancelled');
      counts.pages++;
      const batch = await connector.page(page, options.signal);
      counts.received += batch.records.length;
      for (let index = 0; index < batch.records.length; index++) {
        try {
          const snapshot = normalizeSam(batch.records[index], options.secret);
          const outcome = await ingest(db, snapshot);
          counts[outcome.kind]++;
          await db.query(
            'insert into public.source_sync_items(run_id,page,item_index,record_id,outcome) values($1,$2,$3,$4,$5)',
            [run, page, index, outcome.id, outcome.kind],
          );
        } catch (error) {
          counts.failed++;
          await db.query(
            'insert into public.source_sync_items(run_id,page,item_index,outcome,error_code) values($1,$2,$3,$4,$5)',
            [
              run,
              page,
              index,
              'failed',
              error instanceof SourceError ? error.code : 'record_failed',
            ],
          );
        }
      }
      if ((page + 1) * options.limit >= batch.total) {
        finished = true;
        break;
      }
      if (batch.records.length < options.limit) throw new SourceError('incomplete_page');
    }
    if (!finished) errorCode = 'page_limit';
    if (connector.refresh) {
      // Rotate through the oldest observations; publication-window discovery cannot
      // guarantee that an older notice's amendment will reappear in discovery.
      const tracked = (
        await db.query(`select r.external_id,v.normalized->>'published' as published from public.source_records r join public.source_record_versions v on v.id=r.current_version_id
        where r.last_seen<now()-interval '24 hours' and v.normalized->>'published' is not null order by r.last_checked,r.id limit 10`)
      ).rows;
      for (let index = 0; index < tracked.length; index++) {
        if (options.signal?.aborted) throw new SourceError('cancelled');
        counts.pages++;
        const old = tracked[index];
        await db.query(
          "update public.source_records set last_checked=now() where source_id='sam.gov' and external_id=$1",
          [old.external_id],
        );
        const batch = await connector.refresh(old.external_id, old.published, options.signal);
        counts.received += batch.records.length;
        // Disappearance is ambiguous, never manufacture a cancellation or freshness.
        if (batch.records.length !== 1) {
          counts.failed++;
          await db.query(
            'insert into public.source_sync_items(run_id,page,item_index,outcome,error_code) values($1,$2,0,$3,$4)',
            [run, options.pages + index, 'failed', 'tracked_notice_unavailable'],
          );
          continue;
        }
        const snapshot = normalizeSam(batch.records[0], options.secret);
        if (snapshot.notice.noticeId !== old.external_id)
          throw new SourceError('tracked_identity_mismatch');
        const outcome = await ingest(db, snapshot);
        counts[outcome.kind]++;
        await db.query(
          'insert into public.source_sync_items(run_id,page,item_index,record_id,outcome) values($1,$2,0,$3,$4)',
          [run, options.pages + index, outcome.id, outcome.kind],
        );
      }
    }
    await matchCurrentRecords(db);
  } catch (error) {
    errorCode = error instanceof SourceError ? error.code : 'sync_failed';
  } finally {
    try {
      if (run) {
        const status =
          errorCode || counts.failed
            ? counts.created + counts.updated + counts.unchanged
              ? 'partial'
              : 'failed'
            : 'succeeded';
        await db.query(
          'update public.source_sync_runs set finished_at=now(),status=$2,pages=$3,received=$4,created=$5,updated=$6,unchanged=$7,failed=$8,error_code=$9 where id=$1',
          [
            run,
            status,
            counts.pages,
            counts.received,
            counts.created,
            counts.updated,
            counts.unchanged,
            counts.failed,
            errorCode,
          ],
        );
        await db.query(
          "update public.procurement_sources set last_status=$1,last_success=case when $1='succeeded' then now() else last_success end where id='sam.gov'",
          [status],
        );
      }
    } finally {
      await db.query('select pg_advisory_unlock(1396788551)');
    }
  }
  return { run, ...counts, errorCode };
}

export async function ingest(
  db: Database,
  snapshot: Snapshot,
): Promise<{ kind: 'created' | 'updated' | 'unchanged'; id: string }> {
  await db.query('begin');
  try {
    await db.query('select pg_advisory_xact_lock(1396788552)');
    const exists =
      (
        await db.query(
          "select id from public.source_records where source_id='sam.gov' and external_id=$1",
          [snapshot.notice.noticeId],
        )
      ).rows.length > 0;
    if (
      !exists &&
      (await db.query('select count(*)::integer as count from public.source_records')).rows[0]
        .count >= 10000
    )
      throw new SourceError('record_retention_limit');
    await db.query(
      "insert into public.source_records(source_id,external_id) values('sam.gov',$1) on conflict(source_id,external_id) do nothing",
      [snapshot.notice.noticeId],
    );
    const record = (
      await db.query(
        "select * from public.source_records where source_id='sam.gov' and external_id=$1 for update",
        [snapshot.notice.noticeId],
      )
    ).rows[0];
    const previous = record.current_version_id
      ? (
          await db.query('select * from public.source_record_versions where id=$1', [
            record.current_version_id,
          ])
        ).rows[0]
      : null;
    let kind: 'created' | 'updated' | 'unchanged' = previous ? 'unchanged' : 'created';
    if (!previous || previous.raw_checksum !== snapshot.rawChecksum) {
      const storedBytes = (
        await db.query(
          'select coalesce(sum(octet_length(raw_snapshot::text)+octet_length(normalized::text)),0)::bigint as bytes from public.source_record_versions',
        )
      ).rows[0].bytes;
      if (
        Number(storedBytes) +
          Buffer.byteLength(JSON.stringify(snapshot.raw)) +
          Buffer.byteLength(JSON.stringify(snapshot.notice)) >
        128 * 1024 * 1024
      )
        throw new SourceError('snapshot_storage_limit');
      const total = (
        await db.query(
          'select count(*)::integer as count from public.source_record_versions where record_id=$1',
          [record.id],
        )
      ).rows[0].count;
      if (total >= 200) throw new SourceError('version_retention_limit');
      const change = previous
        ? detectChange(previous.normalized, snapshot.notice)
        : { fields: [], severity: 'none' };
      const version = (
        await db.query(
          'insert into public.source_record_versions(record_id,prior_version_id,raw_snapshot,normalized,raw_checksum,normalized_checksum,changed_fields,severity) values($1,$2,$3,$4,$5,$6,$7,$8) returning id',
          [
            record.id,
            record.current_version_id,
            JSON.stringify(snapshot.raw),
            JSON.stringify(snapshot.notice),
            snapshot.rawChecksum,
            snapshot.normalizedChecksum,
            change.fields,
            change.severity,
          ],
        )
      ).rows[0].id;
      await db.query('update public.source_records set current_version_id=$2 where id=$1', [
        record.id,
        version,
      ]);
      if (previous) {
        kind = 'updated';
        if (change.severity !== 'none')
          await db.query(
            "update public.source_inbox set change_pending=true,priority=case when $2='critical' then 'critical' else priority end where record_id=$1",
            [record.id, change.severity],
          );
      }
    }
    await db.query(
      'update public.source_records set last_seen=now(),last_checked=now() where id=$1',
      [record.id],
    );
    await db.query('commit');
    return { kind, id: record.id };
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
}

async function matchCurrentRecords(db: Database) {
  // Bounded keyset batches; do not silently call a 500-record workspace sample exhaustive.
  const searches = (
    await db.query(
      "select s.* from public.opportunity_searches s join public.organizations o on o.id=s.organization_id where s.active and o.status<>'suspended' order by s.id limit 301",
    )
  ).rows;
  if (searches.length > 300) throw new SourceError('search_capacity');
  for (const search of searches) {
    const parsed = searchFilters.safeParse(search.filters);
    if (!parsed.success) throw new SourceError('invalid_saved_search');
    let cursor = '00000000-0000-0000-0000-000000000000';
    for (let page = 0; page < 20; page++) {
      const records = (
        await db.query(
          'select r.id,r.current_version_id,v.normalized from public.source_records r join public.source_record_versions v on v.id=r.current_version_id where r.id>$1 order by r.id limit 500',
          [cursor],
        )
      ).rows;
      for (const record of records) {
        const match = matchNotice(record.normalized, parsed.data, new Date());
        if (!match) continue;
        // Recheck the search version and organization state at the write boundary.
        await db.query(
          `insert into public.source_inbox(organization_id,record_id,matched_version_id,match_reasons,missing_information,search_id,search_version)
          select $1,$2,$3,$4,$5,$6,$7 where exists(select 1 from public.opportunity_searches s join public.organizations o on o.id=s.organization_id where s.id=$6 and s.active and s.updated_at=$7 and o.status<>'suspended')
          on conflict(organization_id,record_id) do nothing`,
          [
            search.organization_id,
            record.id,
            record.current_version_id,
            JSON.stringify([`Saved search: ${search.name}`, ...match.reasons]),
            JSON.stringify(match.missing),
            search.id,
            search.updated_at,
          ],
        );
      }
      if (records.length < 500) break;
      cursor = records.at(-1)!.id;
      if (page === 19) throw new SourceError('matching_capacity');
    }
    await db.query(
      'update public.opportunity_searches set last_run=now() where id=$1 and updated_at=$2',
      [search.id, search.updated_at],
    );
  }
}
