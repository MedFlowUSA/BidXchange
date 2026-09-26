export async function saveAssistantTask(_: unknown, form: FormData) {
  const response = await fetch('/synthetic-task-save', {
    method: 'POST',
    body: JSON.stringify(Object.fromEntries(form)),
  });
  return response.json();
}
