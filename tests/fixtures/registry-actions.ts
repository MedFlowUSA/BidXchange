export async function saveNormalizedOpportunity(_: unknown, form: FormData) {
  return {
    success: true,
    message: `Saved synthetic normalized source: ${JSON.parse(String(form.get('details'))).sourceId}`,
  };
}
export async function saveSourceRegistration() {
  return { success: true, message: 'Registration evidence saved; no external authentication.' };
}
