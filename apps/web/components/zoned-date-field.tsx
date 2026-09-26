'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { localDateTime, resolveLocalDate } from '../lib/zoned-date';
import styles from './zoned-date-field.module.css';

export default function ZonedDateField({
  name,
  label,
  initialValue,
  timeZone,
  required,
}: {
  name: string;
  label: string;
  initialValue: string;
  timeZone: string;
  required?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [initial] = useState({ value: initialValue, zone: timeZone });
  const [local, setLocal] = useState(() => localDateTime(initialValue, timeZone));
  const [edited, setEdited] = useState(false);
  const [selection, setSelection] = useState({ key: '', instant: '' });
  const result = useMemo(() => resolveLocalDate(local, timeZone), [local, timeZone]);
  const unchanged = !edited && timeZone === initial.zone;
  const key = `${local}|${timeZone}`;
  const original = unchanged
    ? result.choices.find((c) => Date.parse(c.instant) === Date.parse(initial.value))
    : undefined;
  const selected =
    result.choices.length === 1
      ? result.choices[0]
      : (original ??
        result.choices.find((c) => selection.key === key && c.instant === selection.instant));
  const error =
    result.error ??
    (unchanged && initial.value && !local
      ? 'The saved date could not be displayed. Re-enter it after checking the source.'
      : local && !selected
        ? 'This time occurs twice when the clocks change. Choose the occurrence shown in the notice.'
        : '');
  // Retain the exact saved value when no date/zone edit was made, including fractional seconds.
  const value = error
    ? ''
    : selected
      ? unchanged && original
        ? initial.value
        : selected.instant
      : '';
  useEffect(() => {
    input.current?.setCustomValidity(error);
  }, [error]);
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        ref={input}
        id={id}
        type="datetime-local"
        step={local.length > 16 ? '0.001' : '60'}
        required={required}
        value={local}
        aria-describedby={`${id}-help`}
        aria-invalid={Boolean(error)}
        onChange={(event) => {
          setLocal(event.target.value);
          setEdited(true);
          setSelection({ key: '', instant: '' });
        }}
      />
      <input type="hidden" name={name} value={value} />
      {result.choices.length > 1 && (
        <label>
          Which occurrence of {label.toLowerCase()}?
          <select
            value={selected?.instant ?? ''}
            required
            onChange={(event) => {
              setEdited(true);
              setSelection({ key, instant: event.target.value });
            }}
          >
            <option value="">Check the notice and choose</option>
            {result.choices.map((choice) => (
              <option key={choice.instant} value={choice.instant}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <p id={`${id}-help`} aria-live="polite">
        {error ||
          (selected
            ? `Will save: ${selected.label} (${timeZone}).`
            : `Time zone: ${timeZone}. ${required ? 'Check the recorded event time before saving.' : 'Leave blank if unknown.'}`)}
      </p>
    </div>
  );
}
