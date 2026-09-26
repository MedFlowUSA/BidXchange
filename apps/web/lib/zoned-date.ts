// Date entry is interpreted in the explicitly selected zone, never the browser's zone.
// Enumerate nearby offsets and round-trip each candidate to detect clock changes.
function formatter(timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
}

function wallTime(time: number, format: Intl.DateTimeFormat) {
  const parts = Object.fromEntries(format.formatToParts(time).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

export function localDateTime(instant: string, timeZone: string) {
  if (!instant) return '';
  try {
    const time = Date.parse(instant);
    const milliseconds = new Date(time).toISOString().slice(19, 23);
    const local = wallTime(time, formatter(timeZone));
    return milliseconds !== '.000'
      ? local + milliseconds
      : local.endsWith(':00')
        ? local.slice(0, 16)
        : local;
  } catch {
    return '';
  }
}

export type ZonedDateChoice = { instant: string; label: string };
export function resolveLocalDate(
  local: string,
  timeZone: string,
): {
  choices: ZonedDateChoice[];
  error: string | null;
} {
  if (!local) return { choices: [], error: null };
  const invalid = { choices: [], error: 'Enter a valid date and time.' };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(local)) return invalid;
  const naive = Date.parse(local + 'Z');
  if (!Number.isFinite(naive) || Number(local.slice(0, 4)) < 1000) return invalid;
  const canonical = new Date(naive).toISOString().slice(0, -1);
  const expanded =
    local.length === 16
      ? local + ':00.000'
      : local.includes('.')
        ? local.padEnd(23, '0')
        : local + '.000';
  if (canonical !== expanded) return invalid;
  let format: Intl.DateTimeFormat;
  try {
    format = formatter(timeZone);
  } catch {
    return { choices: [], error: 'Choose a valid time zone, such as America/Los_Angeles.' };
  }
  const offsets = new Set<number>();
  const second = Math.floor(naive / 1000) * 1000;
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = second + hours * 3_600_000;
    const offset = Date.parse(wallTime(sample, format) + 'Z') - sample;
    if (Number.isFinite(offset)) offsets.add(offset);
  }
  const choices = [...offsets]
    .map((offset) => naive - offset)
    .filter((time) => wallTime(time, format) === canonical.slice(0, 19))
    .sort((a, b) => a - b)
    .map((time) => ({
      instant: new Date(time).toISOString(),
      label: new Intl.DateTimeFormat('en-US', {
        timeZone,
        dateStyle: 'medium',
        timeStyle: 'long',
      }).format(time),
    }));
  return choices.length
    ? { choices, error: null }
    : {
        choices: [],
        error:
          'This local time does not exist because the clocks change. Check the notice and choose another time.',
      };
}
