'use client';
import { useState } from 'react';
import type { TenantData } from '../lib/tenant-types';
import { calendarPreview, pursuitCalendar } from '../lib/pursuit-calendar';
import styles from './qualification-workspace.module.css';

export default function PursuitCalendar({
  data,
  pursuitId,
}: {
  data: TenantData;
  pursuitId: string;
}) {
  const [includeTasks, setIncludeTasks] = useState(true);
  const [message, setMessage] = useState('');
  const preview = calendarPreview(data, pursuitId, includeTasks);
  function download() {
    try {
      const content = pursuitCalendar(
        data,
        pursuitId,
        location.origin,
        new Date().toISOString(),
        includeTasks,
      );
      const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'bidxchange-pursuit-dates.ics';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        'Calendar file prepared. Import it into your chosen calendar and check the dates. No calendar was connected.',
      );
    } catch {
      setMessage(
        'The calendar file could not be prepared. Refresh the workspace and check the recorded dates.',
      );
    }
  }
  return (
    <details className={styles.calendar}>
      <summary>Take these dates to your calendar</summary>
      <p>
        Download the recorded submission deadline and, optionally, open task deadlines as calendar
        markers. The file contains this pursuit’s title, task titles and links back to BidXchange.
      </p>
      <label>
        <input
          type="checkbox"
          checked={includeTasks}
          onChange={(event) => {
            setIncludeTasks(event.target.checked);
            setMessage('');
          }}
        />{' '}
        Include open task deadlines
      </label>
      <p>
        {preview.events.length} {preview.events.length === 1 ? 'date' : 'dates'} available ·{' '}
        {preview.skipped.length} excluded because a date or time zone needs confirmation. When
        included, task dates use all open tasks regardless of the timeline filter.
      </p>
      {preview.skipped.length > 0 && (
        <p>
          Use “Dates to confirm” below to review task dates, and check the recorded submission
          deadline above.
        </p>
      )}
      {preview.partial && <p>A task limit was reached. This download may omit other tasks.</p>}
      <p>
        A one-time snapshot, not a live connection. Amendments and task changes will not update
        imported entries. Review or replace them after changes; importing again may create
        duplicates. Set notifications in your calendar.
      </p>
      <button
        type="button"
        className="button secondary"
        disabled={!preview.events.length}
        onClick={download}
      >
        Download calendar (.ics)
      </button>
      {message && <p aria-live="polite">{message}</p>}
    </details>
  );
}
