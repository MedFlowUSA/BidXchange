'use client';
import { useActionState } from 'react';
import { requestSignIn, requestSignup, verifyCode } from './actions';
export default function LoginForm({
  next,
  configured,
  signup = false,
}: {
  next: string;
  configured: boolean;
  signup?: boolean;
}) {
  const [state, action, pending] = useActionState(signup ? requestSignup : requestSignIn, {
    message: '',
  });
  const [codeState, codeAction, verifying] = useActionState(verifyCode, { message: '' });
  return (
    <>
      <form action={action} className="opportunity-form">
        <input type="hidden" name="next" value={next} />
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" required maxLength={254} />
        </label>
        <button className="button primary full" disabled={pending || !configured}>
          {pending ? 'Sending…' : signup ? 'Email a confirmation link' : 'Email a sign-in link'}
        </button>
        <p role="status">{state.message}</p>
      </form>
      <details className="code-signin">
        <summary>Use a one-time email code</summary>
        <form action={codeAction} className="opportunity-form">
          <input type="hidden" name="next" value={next} />
          <label>
            Email address
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            One-time code
            <input
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,8}"
              required
            />
          </label>
          <button className="button secondary" disabled={verifying || !configured}>
            {verifying ? 'Verifying…' : 'Verify code'}
          </button>
          <p role="status">{codeState.message}</p>
        </form>
      </details>
    </>
  );
}
