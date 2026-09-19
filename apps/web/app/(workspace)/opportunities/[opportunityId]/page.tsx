import { renderWorkspace, type RouteQuery } from '../../../../lib/route-view';
export default async function Page({
  searchParams,
  params,
}: {
  searchParams: RouteQuery;
  params: Promise<{ opportunityId: string }>;
}) {
  return renderWorkspace(
    'Opportunities',
    searchParams,
    (await params).opportunityId,
    'opportunity',
  );
}
