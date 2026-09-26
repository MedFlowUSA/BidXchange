import { test, expect } from '@playwright/test';
import { calendarPreview, pursuitCalendar } from '../apps/web/lib/pursuit-calendar';
import { workflowData, pursuit } from './fixtures/workflow-data';

const exportedAt = '2026-09-25T15:00:00Z';
const unfold = (value: string) => value.replace(/\r\n /g, '');
const render = (data: ReturnType<typeof workflowData>, includeTasks = true) =>
  pursuitCalendar(data, pursuit, 'https://example.invalid', exportedAt, includeTasks);

test('calendar preserves DST instants and excludes completed, foreign and uncertain dates without mutation', () => {
  const data = workflowData();
  data.tasks = [
    {
      id: 'summer',
      pursuit_id: pursuit,
      title: 'Summer walk',
      status: 'todo',
      due_at: '2026-07-15T09:00:00-07:00',
      due_timezone: 'America/Los_Angeles',
    },
    {
      id: 'winter',
      pursuit_id: pursuit,
      title: 'Winter walk',
      status: 'todo',
      due_at: '2026-12-15T09:00:00-08:00',
      due_timezone: 'America/Los_Angeles',
    },
    { id: 'missing', pursuit_id: pursuit, title: 'Undated', status: 'todo' },
    {
      id: 'zone',
      pursuit_id: pursuit,
      title: 'Bad zone',
      status: 'todo',
      due_at: '2026-10-01T12:00:00Z',
      due_timezone: 'invalid',
    },
    {
      id: 'invalid',
      pursuit_id: pursuit,
      title: 'Bad date',
      status: 'todo',
      due_at: '2026-02-30T12:00:00Z',
      due_timezone: 'UTC',
    },
    {
      id: 'done',
      pursuit_id: pursuit,
      title: 'Completed private task',
      status: 'complete',
      due_at: exportedAt,
      due_timezone: 'UTC',
    },
    {
      id: 'foreign',
      pursuit_id: 'foreign',
      title: 'Foreign private task',
      status: 'todo',
      due_at: exportedAt,
      due_timezone: 'UTC',
    },
  ];
  const before = JSON.stringify(data);
  const preview = calendarPreview(data, pursuit);
  expect(preview.events).toHaveLength(3);
  expect(preview.skipped).toHaveLength(3);
  const calendar = unfold(render(data));
  expect(calendar).toContain('DTSTART:20260715T160000Z');
  expect(calendar).toContain('DTSTART:20261215T170000Z');
  expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(3);
  for (const hidden of [
    'Undated',
    'Bad zone',
    'Bad date',
    'Completed private task',
    'Foreign private task',
    data.userEmail,
  ])
    expect(calendar).not.toContain(hidden);
  expect(unfold(render(data, false)).match(/BEGIN:VEVENT/g)).toHaveLength(1);
  expect(JSON.stringify(data)).toBe(before);
});

test('iCalendar escapes imported text and folds Unicode by bytes without injected properties', () => {
  const data = workflowData();
  const title =
    'Electrical, lighting; \\ work\r\nBEGIN:VALARM\nATTENDEE:mailto:someone@example.invalid ' +
    '工程⚡'.repeat(80);
  data.pursuits[0].title = title;
  const calendar = render(data);
  const lines = calendar.split('\r\n');
  expect(lines.every((line) => Buffer.byteLength(line, 'utf8') <= 75)).toBe(true);
  const plain = unfold(calendar);
  expect(plain.split('\r\n').filter((line) => line.startsWith('BEGIN:'))).toEqual([
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
  ]);
  expect(plain).toContain('Electrical\\, lighting\\; \\\\ work\\nBEGIN:VALARM\\nATTENDEE:');
  expect(plain).toContain('工程⚡'.repeat(80));
  expect(plain).toContain('CLASS:PRIVATE\r\nTRANSP:TRANSPARENT');
  expect(plain).not.toMatch(/\r\n(ATTENDEE|ORGANIZER|ATTACH|METHOD|DTEND):/);
  expect(calendar.endsWith('END:VCALENDAR\r\n')).toBe(true);
});

test('event identities remain stable after amendments but differ between workspaces and tasks', () => {
  const data = workflowData();
  const uid = (value: string) =>
    unfold(value)
      .split('\r\n')
      .filter((line) => line.startsWith('UID:'));
  const original = uid(render(data));
  data.opportunities[0].official_deadline = '2026-10-10T10:00:00Z';
  data.pursuits[0].title = 'Amended title';
  expect(uid(render(data))).toEqual(original);
  data.organization.id = 'another-organization';
  expect(uid(render(data))).not.toEqual(original);
  expect(unfold(render(data))).toContain('organization=another-organization');
  expect(() => pursuitCalendar(data, 'absent', 'https://example.invalid', exportedAt)).toThrow(
    'Pursuit not found',
  );
  expect(() => pursuitCalendar(data, pursuit, 'javascript:alert(1)', exportedAt)).toThrow(
    'Invalid application origin',
  );
  expect(() => pursuitCalendar(data, pursuit, 'https://example.invalid', 'bad-date')).toThrow(
    'Invalid export timestamp',
  );
});

test('unknown submission dates and partial snapshots stay explicit', () => {
  const data = workflowData();
  data.opportunities[0].official_deadline = null;
  expect(calendarPreview(data, pursuit).skipped).toHaveLength(1);
  expect(() => render(data)).toThrow('No recorded dates');
  data.tasks = Array.from({ length: 500 }, (_, index) => ({
    id: `task-${index}`,
    pursuit_id: pursuit,
    title: 'Follow-up',
    status: 'todo',
    due_at: exportedAt,
    due_timezone: 'UTC',
  }));
  expect(calendarPreview(data, pursuit).partial).toBe(true);
  expect(unfold(render(data))).toContain('this export may be incomplete');
  data.pursuits = [];
  expect(calendarPreview(data, pursuit).events).toEqual([]);
});
