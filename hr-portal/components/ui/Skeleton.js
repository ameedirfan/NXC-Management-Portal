// Shimmering placeholders matching the real content's shape, shown while
// a Sheets read is in flight instead of a blank flash or a spinner.

export function Skeleton({ className = '' }) {
  return <div className={`nxc-shimmer rounded ${className}`} />;
}

// A row of cells matching a data table's shape — pass the same column
// count (and optional widths) the real rows will use.
export function SkeletonTableRows({ rows = 4, columns = 3, widths, cellClassName = 'px-4 py-3' }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-t border-brand-100">
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c} className={cellClassName}>
              <Skeleton className={`h-4 ${widths?.[c] || 'w-3/4'}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// A card-shaped placeholder for grid/list layouts (Trips, Contacts).
export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-brand-200 bg-white p-5">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="mt-3 h-5 w-2/3" />
      <Skeleton className="mt-2 h-4 w-1/3" />
    </div>
  );
}
