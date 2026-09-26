'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Answer, ProposedTask } from '../lib/ai/contracts';
import type { TenantData } from '../lib/tenant-types';
import { TaskForm } from './capture-forms';
import { saveAssistantTask } from '../app/assistant-task-actions';
import { workspaceHref } from '../lib/routes';
import styles from './assistant.module.css';

function Proposal({
  proposal,
  answer,
  data,
  pursuitId,
}: {
  proposal: ProposedTask;
  answer: Answer;
  data: TenantData;
  pursuitId: string;
}) {
  const [creationId] = useState(() => crypto.randomUUID());
  const [dismissed, setDismissed] = useState(false);
  const canSave = ['organization_admin', 'capture_manager'].includes(data.organization.role);
  const requirementId = proposal.requirementKey?.replace(/^requirement:/, '');
  const requirement = data.requirements?.find(
    (r) => r.id === requirementId && r.pursuit_id === pursuitId,
  );
  const existing = data.tasks.filter(
    (task) =>
      task.pursuit_id === pursuitId &&
      (requirementId
        ? task.requirement_id === requirementId
        : task.title.toLowerCase() === proposal.title.toLowerCase()),
  );
  if (dismissed)
    return (
      <p>
        Proposal dismissed.{' '}
        <button className="text-button" onClick={() => setDismissed(false)}>
          Restore proposal
        </button>
      </p>
    );
  const references = answer.citations.filter((c) => proposal.sources.includes(c.key));
  return (
    <article className={styles.planCard}>
      <h4>{proposal.title}</h4>
      <p>{proposal.explanation}</p>
      {requirement && (
        <details>
          <summary>Review the linked requirement wording</summary>
          <p>{requirement.requirement}</p>
          <p>{requirement.citation}</p>
          <p>
            {answer.sharedRequirement?.id === requirement.id ||
            answer.sharedRequirements?.some((item) => item.id === requirement.id)
              ? 'The assistant used the excerpt you selected. Review the full wording and AI suggestion before saving a follow-up.'
              : 'The assistant used status metadata, not this private clause text. Check the wording before saving a follow-up.'}
          </p>
        </details>
      )}
      <ul>
        {references.map((source) => (
          <li key={source.key}>
            {source.href ? <Link href={source.href}>{source.title}</Link> : source.title} ·{' '}
            {source.status.replaceAll('_', ' ')}
          </li>
        ))}
      </ul>
      {existing.length > 0 && (
        <div>
          <strong>Check existing work before adding another task</strong>
          <ul>
            {existing.map((task) => (
              <li key={task.id}>
                <Link
                  href={
                    workspaceHref(`/pursuits/${pursuitId}`, data.organization.id) +
                    `#task-${task.id}`
                  }
                >
                  {task.title}
                </Link>{' '}
                · {task.status.replaceAll('_', ' ')}
              </li>
            ))}
          </ul>
        </div>
      )}
      {requirementId && !requirement ? (
        <p>Refresh the pursuit to review the linked requirement before saving this proposal.</p>
      ) : canSave && answer.actionToken ? (
        <TaskForm
          data={{
            ...data,
            requirements: data.requirements?.filter((r) =>
              answer.citations.some((c) => c.type === 'requirement' && c.id === r.id),
            ),
          }}
          pursuitId={pursuitId}
          suggestedTitle={proposal.title}
          suggestedRequirementId={requirement?.id}
          suggestedNotes={`AI-proposed follow-up; reviewed by the user before saving.\n${proposal.explanation}\nSource records: ${proposal.sources.join(', ')}`}
          review={{ token: answer.actionToken, creationId }}
          action={saveAssistantTask}
        />
      ) : (
        <p>
          {canSave
            ? 'Refresh the answer to prepare a current task review.'
            : 'A capture manager or administrator can review and save tasks.'}
        </p>
      )}
      <button type="button" className="text-button" onClick={() => setDismissed(true)}>
        Dismiss proposal
      </button>
    </article>
  );
}
export default function AssistantTaskPlan({
  answer,
  data,
  pursuitId,
}: {
  answer: Answer;
  data: TenantData;
  pursuitId: string;
}) {
  if (!answer.proposedTasks?.length || !data.pursuits.some((p) => p.id === pursuitId)) return null;
  return (
    <section aria-label="AI-proposed bid plan" className={styles.taskPlan}>
      <h3>Review proposed follow-up tasks</h3>
      <p>
        AI suggestions, not saved tasks. Review the sources, check existing work, then choose an
        owner and deadline. Saving a task does not resolve a requirement or approve a bid.
      </p>
      <p>
        Saved task titles and notes are shared with the pursuit team. Remove restricted financial or
        personnel details before saving.
      </p>
      {answer.proposedTasks.map((proposal, index) => (
        <Proposal
          key={index}
          proposal={proposal}
          answer={answer}
          data={data}
          pursuitId={pursuitId}
        />
      ))}
    </section>
  );
}
