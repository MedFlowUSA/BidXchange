'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { TenantData } from '../lib/tenant-types';
import { qualificationMap } from '../lib/qualification-map';
import { resolutionLabels } from '../lib/requirement-resolution';
import { TaskForm } from './capture-forms';
import BidControl from './bid-control';
import styles from './qualification-workspace.module.css';

export default function QualificationWorkspace({
  data,
  pursuitId,
}: {
  data: TenantData;
  pursuitId: string;
}) {
  const map = qualificationMap(data, pursuitId);
  const [attentionOnly, setAttentionOnly] = useState(true);
  const [selectedFact, setSelectedFact] = useState('');
  const base = `/pursuits/${pursuitId}?organization=${data.organization.id}`;
  const company = `/company?organization=${data.organization.id}`;
  const capture = ['organization_admin', 'capture_manager'].includes(data.organization.role);
  const pursuitTasks = data.tasks.filter((task) => task.pursuit_id === pursuitId);
  const rows = map.rows.filter(
    (r) =>
      (!attentionOnly || r.actions.length > 0) &&
      (!selectedFact || r.evidence.some((e) => e.fact.id === selectedFact)),
  );
  return (
    <div className={styles.workspace}>
      <header className="panel">
        <div className="eyebrow">Bid control</div>
        <h1>Requirements, evidence and next actions for this bid</h1>
        <p>{map.opportunity?.title}</p>
        <p>
          Start with the blockers, follow the evidence, then assign the next action. This is a view
          of recorded reviews, not an eligibility score or a submission approval.
        </p>
        <div className={styles.metrics}>
          <div>
            <strong>{map.blocked}</strong>
            <span>Recorded blockers</span>
          </div>
          <div>
            <strong>{map.needingAction}</strong>
            <span>Requirements needing action</span>
          </div>
          <div>
            <strong>{map.dependencies.length}</strong>
            <span>Linked evidence records visible</span>
          </div>
        </div>
        {map.blocked > 0 && (
          <p className="info-note" role="status">
            A recorded blocker remains open. Support for other requirements does not cancel it.
            Resolve it with the authorized reviewer before relying on a bid decision.
          </p>
        )}
        <p>
          Submission deadline: {map.opportunity?.official_deadline ?? 'Not recorded'} ·{' '}
          {map.opportunity?.deadline_timezone ?? 'Time zone unknown'}.
        </p>
        {map.deadlinePassed && (
          <p role="status">
            The recorded deadline has passed. Confirm an official extension before planning a
            submission.
          </p>
        )}
        {!map.deadlineDay && (
          <p>
            Deadline coverage cannot be compared until a valid deadline and time zone are recorded.
          </p>
        )}
        <p className={styles.note}>
          Snapshot: {data.reviewAsOf}. Refresh after changes. Expiration comparisons use the
          deadline’s recorded time zone; coverage after submission needs a separate review.
        </p>
        {(map.partial || map.hiddenEvidence || map.unavailable || map.unreadableDrafts) && (
          <p role="status" className="info-note">
            {map.partial && 'A record limit was reached; this view is partial. '}
            {map.hiddenEvidence && 'Some linked evidence is outside your visible records. '}
            {map.unavailable && 'Evidence or requirement reviews are unavailable. '}
            {map.unreadableDrafts && 'Some saved response formats could not be read. '}
            Missing information must be reviewed before making a decision.
          </p>
        )}
        <nav className={styles.links} aria-label="Qualification workflow">
          <Link href={base}>Pursuit and requirement reviews</Link>
          <Link href={`${base}#response-release`}>Submission approvals</Link>
          <Link href={`${company}#company-readiness`}>Company evidence</Link>
        </nav>
      </header>
      <BidControl key={pursuitId} data={data} pursuitId={pursuitId} />
      <section className="panel" aria-labelledby="evidence-path-title">
        <div className="eyebrow">Evidence graph</div>
        <h2 id="evidence-path-title">Trace a record through this pursuit.</h2>
        <p>
          Company record → requirement-specific review → notice requirement → saved response
          section. These are recorded relationships; a linked section is not proof that every
          sentence is supported.
        </p>
        <label htmlFor="dependency-filter">Follow an evidence record</label>
        <select
          id="dependency-filter"
          className={styles.select}
          value={selectedFact}
          onChange={(e) => setSelectedFact(e.target.value)}
        >
          <option value="">All visible evidence paths</option>
          {map.dependencies.map((d) => (
            <option key={d.fact.id} value={d.fact.id}>
              {d.fact.label} · {d.requirements.length} requirements · {d.responseCount} response
              drafts{d.needsAttention ? ' · needs review' : ''}
            </option>
          ))}
        </select>
        {!map.dependencies.length && (
          <p>
            No evidence paths are visible yet. Open a requirement and record an evidence-use review
            to establish a relationship.
          </p>
        )}
        <p className={styles.note}>
          Records used by several requirements appear first when they need attention. Reviewing one
          record can help several reviews, but each requirement still needs its own approval.
        </p>
      </section>
      <section className="panel" aria-labelledby="gap-roadmap-title">
        <div className="eyebrow">Reverse qualification</div>
        <h2 id="gap-roadmap-title">Turn review gaps into next actions.</h2>
        <label className={styles.filter}>
          <input
            type="checkbox"
            checked={attentionOnly}
            onChange={(e) => setAttentionOnly(e.target.checked)}
          />{' '}
          Show only requirements needing action
        </label>
        {!map.rows.length && (
          <p>
            No notice requirements have been recorded. Add the requirements and their citations in
            the pursuit before assessing qualification.
          </p>
        )}
        {map.rows.length > 0 && !rows.length && (
          <p>
            No requirements match this filter. This does not establish eligibility or authorize
            submission.
          </p>
        )}
        <div className={styles.rows}>
          {rows.map((row) => (
            <article key={row.requirement.id} className={styles.row}>
              <h3>
                <Link href={`${base}#requirement-${row.requirement.id}`}>
                  {row.requirement.requirement}
                </Link>
              </h3>
              <p>
                <strong>
                  {row.resolution?.review_current
                    ? resolutionLabels[row.resolution.disposition]
                    : row.blocked
                      ? 'Recorded blocker — review required'
                      : 'Requires current human review'}
                </strong>
              </p>
              <p>
                Notice: {row.requirement.citation || 'Citation missing'}
                <br />
                Owner:{' '}
                {row.requirement.owner_user_id === data.userId
                  ? 'You'
                  : row.requirement.owner_user_id || 'Unassigned'}
              </p>
              {row.actions.length ? (
                <ol className={styles.actions}>
                  {row.actions.map((a) => (
                    <li key={a.kind}>
                      <strong>{a.title}</strong>
                      <p>{a.detail}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>
                  No follow-up was identified in this visible snapshot. Confirm the scope and
                  continued validity of the human finding.
                </p>
              )}
              <details>
                <summary>
                  Evidence and response trail ({row.evidence.length} records, {row.answers.length}{' '}
                  sections)
                </summary>
                {!row.evidence.length && (
                  <p>
                    No visible company evidence is linked. A documented waiver may have a separate
                    authority reference in the requirement review.
                  </p>
                )}
                <ul>
                  {row.evidence.map((e) => (
                    <li key={e.fact.id}>
                      <Link href={`${company}#fact-${e.fact.id}`}>{e.fact.label}</Link> —{' '}
                      {e.status.replaceAll('_', ' ')};{' '}
                      {e.approved ? 'current use approval' : 'no current use approval'}.
                      <p>
                        Source: {e.fact.source_reference || 'Not recorded'}. Expires:{' '}
                        {e.fact.expiration_date || 'Not recorded'}
                        {e.needsRenewal ? ' — on or before the submission deadline.' : '.'}
                      </p>
                    </li>
                  ))}
                </ul>
                {!row.answers.length && (
                  <p>No saved response section is mapped to this requirement.</p>
                )}
                <ul>
                  {row.answers.map((a) => (
                    <li key={a.id}>
                      {a.title}: {a.sourceChanged ? 'requirement version changed; ' : ''}
                      {a.contextChanged ? 'review context changed; ' : ''}
                      {a.unfinished
                        ? 'unfinished answer'
                        : 'answer present; content still needs review'}
                    </li>
                  ))}
                </ul>
              </details>
              <details>
                <summary>
                  Linked follow-up tasks (
                  {pursuitTasks.filter((task) => task.requirement_id === row.requirement.id).length}
                  )
                </summary>
                {pursuitTasks.some((task) => task.requirement_id === row.requirement.id) ? (
                  <ul>
                    {pursuitTasks
                      .filter((task) => task.requirement_id === row.requirement.id)
                      .map((task) => (
                        <li key={task.id}>
                          <Link href={`${base}#task-${task.id}`}>{task.title}</Link> ·{' '}
                          {task.status.replaceAll('_', ' ')} ·{' '}
                          {task.assigned_user_id === data.userId
                            ? 'You'
                            : task.assigned_user_id || 'Unassigned'}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p>
                    No linked task is visible. Check existing pursuit tasks before assigning more
                    work.
                  </p>
                )}
              </details>
              {capture && row.actions.length > 0 && (
                <details>
                  <summary>Assign follow-up work</summary>
                  <p>
                    Review existing pursuit tasks before adding another. Completing a task does not
                    resolve the requirement or approve evidence.
                  </p>
                  <Link href={`${base}#pursuit-tasks`}>Review existing tasks</Link>
                  <TaskForm
                    data={data}
                    pursuitId={pursuitId}
                    suggestedRequirementId={row.requirement.id}
                    suggestedTitle={`Review requirement: ${row.requirement.requirement}`.slice(
                      0,
                      200,
                    )}
                  />
                </details>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
