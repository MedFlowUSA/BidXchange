import { expect, test } from '@playwright/test';
import { localDateTime, resolveLocalDate } from '../apps/web/lib/zoned-date';

test('deadlines use the named zone across summer, winter and non-hour offsets', () => {
  for (const [local, zone, instant] of [
    ['2026-10-15T14:00', 'America/Los_Angeles', '2026-10-15T21:00:00.000Z'],
    ['2026-12-15T14:00', 'America/Los_Angeles', '2026-12-15T22:00:00.000Z'],
    ['2026-10-15T14:00', 'Asia/Kathmandu', '2026-10-15T08:15:00.000Z'],
    ['2026-10-15T00:00', 'UTC', '2026-10-15T00:00:00.000Z'],
    ['2028-02-29T14:00:30.125', 'America/New_York', '2028-02-29T19:00:30.125Z'],
    ['9999-12-31T12:00', 'UTC', '9999-12-31T12:00:00.000Z'],
  ]) {
    const result = resolveLocalDate(local, zone);
    expect(result.error).toBeNull();
    expect(result.choices.map((c) => c.instant)).toEqual([instant]);
    expect(localDateTime(instant, zone)).toBe(local);
  }
});

test('clock gaps are rejected and repeated times require an explicit occurrence', () => {
  expect(resolveLocalDate('2026-03-08T02:30', 'America/Los_Angeles').error).toContain(
    'does not exist',
  );
  const fall = resolveLocalDate('2026-11-01T01:30', 'America/Los_Angeles');
  expect(fall.choices.map((c) => c.instant)).toEqual([
    '2026-11-01T08:30:00.000Z',
    '2026-11-01T09:30:00.000Z',
  ]);
  expect(fall.choices[0].label).not.toBe(fall.choices[1].label);
  expect(
    resolveLocalDate('2026-04-05T01:45', 'Australia/Lord_Howe').choices.map((c) => c.instant),
  ).toEqual(['2026-04-04T14:45:00.000Z', '2026-04-04T15:15:00.000Z']);
  expect(resolveLocalDate('2011-12-30T12:00', 'Pacific/Apia').error).toContain('does not exist');
});

test('invalid dates and zones never normalize silently or depend on the computer zone', () => {
  for (const local of [
    '2026-02-30T14:00',
    '2026-13-01T00:00',
    '2026-01-01T24:00',
    '2026-10-15',
    '2026-10-15T14:00Z',
    'tomorrow',
  ])
    expect(resolveLocalDate(local, 'America/Los_Angeles').error).toBeTruthy();
  expect(resolveLocalDate('2026-10-15T14:00', 'Pacific-ish').error).toContain('valid time zone');
  expect(resolveLocalDate('', 'America/Los_Angeles')).toEqual({ choices: [], error: null });
  expect(localDateTime('invalid', 'UTC')).toBe('');
  expect(localDateTime('2026-01-01T00:00:00Z', 'bad')).toBe('');
});
