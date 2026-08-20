import { Skeleton } from '@/components/ui/Skeleton';

// Next.js shows this automatically while a portal route's server render is
// in flight during navigation — the gap between clicking a NavBar tab and
// the page's own client-side data fetch even starting. Every portal route
// is fully dynamic (the layout reads the session cookie), so that gap is
// real, not instant, and previously showed nothing at all. This is
// intentionally generic (not page-specific): it's a brief transitional
// flash, then the destination page's own skeleton (already built per
// page) takes over for its data fetch.
export default function PortalLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-6">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-5/6" />
        <Skeleton className="mt-3 h-4 w-2/3" />
      </div>
    </div>
  );
}
