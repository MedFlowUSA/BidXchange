export async function saveReleaseAction(_state: unknown, form: FormData) {
  const d = JSON.parse(String(form.get('payload')));
  return {
    message: d.confirmed
      ? 'Synthetic submission captured; no buyer action.'
      : 'Synthetic action captured.',
    success: true,
  };
}
