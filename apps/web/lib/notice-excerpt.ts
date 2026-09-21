export type NoticeCandidate = { text: string; citation: string; line: number };

// Deliberately deterministic: preserve the supplied text, never invent source pages or claims.
export function noticeCandidates(source: string, location: string, excerpt: string) {
  if (!source.trim() || source.length > 300 || !location.trim() || location.length > 120)
    throw new Error('Enter a notice title/version and its page or section.');
  if (!excerpt.trim() || excerpt.length > 24000)
    throw new Error('Paste up to 24,000 characters from one identified page or section.');
  const candidates: NoticeCandidate[] = [];
  let omitted = 0;
  const seen = new Set<string>();
  const lines = excerpt.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].trim();
    if (
      !/\b(must|shall|required|mandatory|submit|provide|include|deadline|no later than)\b/i.test(
        text,
      )
    )
      continue;
    if (text.length > 1200 || candidates.length >= 20) {
      omitted++;
      continue;
    }
    if (seen.has(text)) continue;
    seen.add(text);
    candidates.push({
      text,
      line: i + 1,
      citation: `${source.trim()} — ${location.trim()}\nUser-transcribed excerpt, pasted line ${i + 1} (not independently verified):\n“${text}”`,
    });
  }
  return { candidates, omitted };
}
