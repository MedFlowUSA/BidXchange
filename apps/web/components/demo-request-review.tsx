'use client';
import { useActionState } from 'react';
import { reviewDemoRequest } from '../app/operations/actions';

export default function DemoRequestReview({
  id,
  version,
  status,
}: {
  id: string;
  version: number;
  status: string;
}) {
  const [state, action, pending] = useActionState(reviewDemoRequest, { message: '' });
  return (
    <form action={action}>
      <input name="id" value={id} type="hidden" />
      <input name="version" value={version} type="hidden" />
      <label>
        Status{' '}
        <select name="status" defaultValue={status} disabled={pending}>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="closed">Closed</option>
          <option value="erase">Erase contact details</option>
        </select>
      </label>
      <label>
        <input type="checkbox" name="confirm" value="yes" disabled={pending} /> Confirm permanent
        erasure (only for Erase)
      </label>
      <button disabled={pending} type="submit">
        {pending ? 'Saving…' : 'Save'}
      </button>
      <p role="status">{state.message}</p>
    </form>
  );
}
