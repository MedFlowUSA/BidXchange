import { test, expect } from '@playwright/test';
import {
  validDocumentBytes,
  documentObjectPath,
  maxDocumentBytes,
} from '../apps/web/lib/document-files';
test('document intake checks bytes and size, not an extension alone', () => {
  expect(validDocumentBytes(new TextEncoder().encode('%PDF-1.7\nfixture'))).toBe(true);
  expect(validDocumentBytes(new TextEncoder().encode('<html>not a pdf</html>'))).toBe(false);
  expect(validDocumentBytes(new TextEncoder().encode('%PDF-'))).toBe(false);
  const oversized = new Uint8Array(maxDocumentBytes + 1);
  oversized.set(new TextEncoder().encode('%PDF-1.7'));
  expect(validDocumentBytes(oversized)).toBe(false);
  expect(documentObjectPath('organization', 'version')).toBe('organization/version.pdf');
});
