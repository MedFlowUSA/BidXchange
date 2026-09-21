export async function saveCompanyRecord(_state: unknown, form: FormData) {
  const fields = JSON.parse(String(form.get('structured_fields')));
  return { success: true, message: `${form.get('structured_kind')}: ${fields.line1}` };
}
