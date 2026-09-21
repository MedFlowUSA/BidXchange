export async function saveOpportunity(_: unknown, form: FormData) {
  return {
    success: true,
    message: JSON.stringify(Object.fromEntries(form)),
    href: '/opportunities/synthetic',
  };
}
export async function savePursuitTask(_: unknown, form: FormData) {
  return { success: true, message: `Task saved: ${form.get('title')}` };
}
export async function saveRequirement(_: unknown, form: FormData) {
  return { success: true, message: `Requirement saved: ${form.get('citation')}` };
}
export async function startPursuit() {
  return { success: true, message: 'Saved' };
}
