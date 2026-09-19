import { createElement } from 'react';

// Accept only a server-validated identity flag; never organization or user details.
export default function PublicWorkspaceAccess({
  signedIn,
  className,
  onClick,
}: {
  signedIn: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return signedIn
    ? createElement('a', { href: '/dashboard', className, onClick }, 'Open Workspace')
    : null;
}
