import { AlertTriangle } from 'lucide-react';

// The "Sheets API slow/unreachable" unhappy path: a clear, non-technical
// message plus a way to try again, not a raw error string or a spinner
// that never resolves.
export default function ErrorRetry({ message, onRetry, className = '' }) {
  return (
    <div className={`flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center ${className}`}>
      <AlertTriangle size={24} className="text-red-600" aria-hidden="true" />
      <p className="text-sm text-red-800">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          // bg-red-100, not bg-brand-50: the brand tokens flip with the
          // theme while Tailwind's red-* palette does not, so in dark
          // mode this button became dark-red text on a near-black
          // (rgb 28,21,13) background — measured 2.17:1, unreadable.
          // Keeping the whole control on the fixed red palette makes it
          // identical in both themes, at 8.2:1.
          className="rounded-lg border border-red-300 bg-red-100 px-4 py-1.5 text-sm font-medium text-red-900 hover:bg-red-200"
        >
          Try again
        </button>
      )}
    </div>
  );
}
