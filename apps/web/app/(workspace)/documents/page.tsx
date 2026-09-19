import { renderWorkspace, type RouteQuery } from '../../../lib/route-view';
export default function Page({ searchParams }: { searchParams: RouteQuery }) {
  return renderWorkspace('Documents', searchParams);
}
