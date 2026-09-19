import { test, expect } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PublicWorkspaceAccess from '../apps/web/components/public-workspace-access';

test('public workspace entry is limited to a validated identity flag', () => {
  expect(renderToStaticMarkup(createElement(PublicWorkspaceAccess, { signedIn: false }))).toBe('');
  const authenticated = renderToStaticMarkup(
    createElement(PublicWorkspaceAccess, { signedIn: true }),
  );
  expect(authenticated).toBe('<a href="/dashboard">Open Workspace</a>');
  // Only a workspace destination is exposed; user and tenant details are not accepted props.
});
