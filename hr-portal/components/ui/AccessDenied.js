import { ShieldOff } from 'lucide-react';
import Link from 'next/link';

// "A member somehow lands on an admin-only route" — a calm, clear state,
// not a raw error string or a broken page.
export default function AccessDenied({ message }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-brand-200 bg-white px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
        <ShieldOff size={22} className="text-brand-500" aria-hidden="true" />
      </div>
      <p className="mt-4 font-serif text-lg font-semibold text-brand-900">You don't have access to this</p>
      <p className="mt-1 max-w-sm text-sm text-brand-500">{message}</p>
      <Link href="/attendance" className="mt-5 text-sm font-medium text-brand-900 hover:underline">
        Back to Attendance
      </Link>
    </div>
  );
}
