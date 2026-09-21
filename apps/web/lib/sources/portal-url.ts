import { externalUrl } from './normalized';
export function reviewedPortalUrl(value: string | null | undefined): string | null {
  if (!value || !externalUrl.safeParse(value).success) return null;
  const url = new URL(value);
  if (
    url.hash ||
    [...url.searchParams.keys()].some((key) =>
      /token|secret|password|api.?key|authorization|credential|signature/i.test(key),
    )
  )
    return null;
  return url.href;
}
