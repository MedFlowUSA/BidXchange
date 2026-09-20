// Linear comparison; highlights the changed span without interpreting source meaning.
export function amendmentPreview(before: string, after: string) {
  const oldText = Array.from(before.trim()),
    newText = Array.from(after.trim());
  let start = 0;
  while (start < oldText.length && start < newText.length && oldText[start] === newText[start])
    start++;
  let end = 0;
  while (
    end < oldText.length - start &&
    end < newText.length - start &&
    oldText[oldText.length - 1 - end] === newText[newText.length - 1 - end]
  )
    end++;
  return {
    changed: before.trim() !== after.trim(),
    prefix: oldText.slice(0, start).join(''),
    removed: oldText.slice(start, oldText.length - end).join(''),
    inserted: newText.slice(start, newText.length - end).join(''),
    suffix: end ? oldText.slice(-end).join('') : '',
  };
}
