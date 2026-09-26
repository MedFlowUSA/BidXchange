import { notFound } from 'next/navigation';
import { z } from 'zod';
import Link from 'next/link';
import { authorizeAi } from '../../../../../../lib/ai/server';
import { EvidenceTools } from '../../../../../../lib/ai/tools';
import { evidenceLabel, evidenceValue } from '../../../../../../lib/ai/display';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ organization?: string }>;
}) {
  const { kind, id } = await params;
  const { organization } = await searchParams;
  if (!organization || !z.uuid().safeParse(id).success) notFound();
  let source;
  try {
    const { db, role } = await authorizeAi(organization);
    source = await new EvidenceTools(db, organization, role).source(kind, id);
  } catch {
    notFound();
  }
  return (
    <main>
      <section className="panel">
        <Link href={`/assistant?organization=${organization}`}>Back to BidBuddy</Link>
        <h1>{source.citation.title}</h1>
        {typeof source.fields.workspaceRoute === 'string' && (
          <Link href={source.fields.workspaceRoute}>Open the workspace record</Link>
        )}
        <p>
          {source.citation.type} · {source.citation.status} · Organization: {organization}
        </p>
        <p>Record ID: {id}</p>
        <p>
          Source date: {source.citation.sourceDate ?? 'unknown'} · Updated:{' '}
          {source.citation.updatedAt ?? 'unknown'}
        </p>
        <dl>
          {Object.entries(source.fields)
            .filter(([key]) => key !== 'workspaceRoute')
            .map(([key, value]) => (
              <div key={key}>
                <dt>{evidenceLabel(key)}</dt>
                <dd>{evidenceValue(value)}</dd>
              </div>
            ))}
        </dl>
      </section>
    </main>
  );
}
