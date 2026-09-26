import { AiError, type Evidence, type ProposedTask } from './contracts';

export function validateTaskProposals(
  proposals: ProposedTask[],
  evidence: Map<string, Evidence>,
  pursuitId: string,
  org: string,
) {
  const pursuit = evidence.get(`pursuit:${pursuitId}`);
  if (!pursuit && proposals.length) throw new AiError('invalid_answer', 502);
  for (const proposal of proposals) {
    const keys = [
      ...proposal.sources,
      ...(proposal.requirementKey ? [proposal.requirementKey] : []),
    ];
    for (const key of keys) {
      const record = evidence.get(key);
      if (!record || !['fact', 'pursuit', 'requirement', 'task'].includes(record.citation.type))
        throw new AiError('invalid_answer', 502);
      if (
        record.citation.type !== 'fact' &&
        record.fields.workspaceRoute !== `/pursuits/${pursuitId}?organization=${org}`
      )
        throw new AiError('invalid_answer', 502);
    }
    if (
      proposal.requirementKey &&
      (!proposal.sources.includes(proposal.requirementKey) ||
        evidence.get(proposal.requirementKey)?.citation.type !== 'requirement')
    )
      throw new AiError('invalid_answer', 502);
  }
  return proposals;
}
