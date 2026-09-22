import { safeNext } from './routes';

export function signInRecoveryHref(next: unknown) {
  return `/login?error=callback&next=${encodeURIComponent(safeNext(next))}`;
}

export const signInUnavailable =
  'Sign-in is temporarily unavailable. Please try again shortly. If the problem continues, contact your organization administrator.';
