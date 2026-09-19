export default function AiPreview() {
  return (
    <section className="panel ai-preview">
      <div className="eyebrow">ASK BIDXCHANGE</div>
      <h2>Questions that move a pursuit forward.</h2>
      <p>Coming in a later phase – no live AI analysis enabled.</p>
      <ul>
        {[
          'What new contracts are available today?',
          'Why does this opportunity fit GES?',
          'What could disqualify us?',
          'What deadlines are approaching?',
          'What changed in the latest addendum?',
        ].map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ul>
    </section>
  );
}
