export const maxDocumentBytes = 2 * 1024 * 1024;
export function validDocumentBytes(bytes: Uint8Array) {
  return (
    bytes.length > 8 &&
    bytes.length <= maxDocumentBytes &&
    new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-'
  );
}
export function documentObjectPath(organization: string, version: string) {
  return `${organization}/${version}.pdf`;
}
