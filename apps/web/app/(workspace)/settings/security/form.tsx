'use client';
import { useActionState } from 'react';
import { signOutAllDevices } from './actions';

export default function SecurityForm() {
  const [state, action, pending] = useActionState(signOutAllDevices, { message: '' });
  return (
    <form action={action} className="opportunity-form">
      <p>
        Use this after using a shared computer or if you suspect someone else has your session. Save
        your work first. You will need a new sign-in email to return.
      </p>
      <p>
        This ends session renewal across your devices. Existing access may continue until its
        current token expires; it does not instantly disconnect every device or erase downloaded
        files.
      </p>
      <label>
        <input type="checkbox" name="confirm" value="yes" required disabled={pending} />I want to
        sign out all devices, including this one.
      </label>
      <button className="button primary" disabled={pending}>
        {pending ? 'Signing out…' : 'Sign out all devices'}
      </button>
      <p role="status">{state.message}</p>
    </form>
  );
}
