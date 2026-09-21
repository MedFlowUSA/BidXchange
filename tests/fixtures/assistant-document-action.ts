// Browser harness substitute for Next's server-action transport. Real session
// authorization and persistence are tested in staging/capture-hosted.mjs.
export async function createAssistantDocument(input: unknown) {
  const response = await fetch('/test-document-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return response.json();
}
