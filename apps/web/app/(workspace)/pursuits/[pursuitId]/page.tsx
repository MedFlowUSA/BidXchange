import { renderWorkspace, type RouteQuery } from '../../../../lib/route-view';
export default async function Page({
  searchParams,
  params,
}: {
  searchParams: RouteQuery;
  params: Promise<{ pursuitId: string }>;
}) {
  return renderWorkspace('Pursuits', searchParams, (await params).pursuitId, 'pursuit');
}
