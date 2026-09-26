import { z } from 'zod';
import { bidControl } from './bid-control';
import { workspaceHref } from './routes';
import type { TenantData } from './tenant-types';

const text = (value: string) =>
  value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
const utc = (time: number) =>
  new Date(time)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');

// RFC 5545: fold at 75 UTF-8 octets, never inside a Unicode code point.
function fold(line: string) {
  const encoder = new TextEncoder();
  let result = '',
    size = 0;
  for (const character of line) {
    const bytes = encoder.encode(character).length;
    if (size + bytes > 75) {
      result += '\r\n ';
      size = 1;
    }
    result += character;
    size += bytes;
  }
  return result;
}

export function calendarPreview(data: TenantData, pursuitId: string, includeTasks = true) {
  const control = bidControl(data, pursuitId);
  const selected = control.dates.filter((item) => includeTasks || item.taskId === null);
  return {
    events: selected.filter((item) => !item.needsDateReview),
    skipped: selected.filter((item) => item.needsDateReview),
    partial: control.partial,
  };
}

export function pursuitCalendar(
  data: TenantData,
  pursuitId: string,
  origin: string,
  generatedAt: string,
  includeTasks = true,
) {
  const pursuit = data.pursuits.find((item) => item.id === pursuitId);
  if (!pursuit) throw new Error('Pursuit not found in this workspace.');
  const base = new URL(origin);
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password)
    throw new Error('Invalid application origin.');
  if (!z.iso.datetime({ offset: true }).safeParse(generatedAt).success)
    throw new Error('Invalid export timestamp.');
  const preview = calendarPreview(data, pursuitId, includeTasks);
  if (!preview.events.length) throw new Error('No recorded dates are ready to export.');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BidXchange//Pursuit dates//EN',
    'CALSCALE:GREGORIAN',
  ];
  for (const event of preview.events) {
    const record = event.taskId ? `task-${event.taskId}` : 'submission';
    const uid =
      [data.organization.id, pursuitId, record].map(encodeURIComponent).join('/') + '@bidxchange';
    const path =
      workspaceHref(`/pursuits/${encodeURIComponent(pursuitId)}`, data.organization.id) +
      (event.taskId ? `#task-${encodeURIComponent(event.taskId)}` : '');
    const href = new URL(path, base.origin).href;
    const description = [
      `Recorded date: ${event.label}`,
      `Workspace snapshot: ${data.reviewAsOf}`,
      'Check the official notice and current workspace before acting. This is a deadline marker, not a meeting invitation or a submission confirmation.',
      'One-time export: changes, completed tasks and amendments do not update this calendar. Review or replace imported entries after changes.',
      ...(preview.partial
        ? ['The workspace task limit was reached; this export may be incomplete.']
        : []),
      `Open BidXchange (sign-in required): ${href}`,
    ].join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${utc(Date.parse(generatedAt))}`,
      `DTSTART:${utc(event.time!)}`,
      `SUMMARY:${text(`${event.taskId ? 'Task deadline: ' : ''}${event.title} — ${pursuit.title}`)}`,
      `DESCRIPTION:${text(description)}`,
      `URL:${href}`,
      'CLASS:PRIVATE',
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
