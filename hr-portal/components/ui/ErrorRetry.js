import { AlertTriangle } from 'lucide-react';

// The "Sheets API slow/unreachable" unhappy path: a clear, non-technical
// message plus a way to try again, not a raw error string or a spinner
// that never resolves.
export default function ErrorRetry({ message, onRetry, className = '' }) {
  return (
    <div className={`flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center ${className}`}>
      <AlertTriangle size={20} className="text-red-600" aria-hidden="true" />
      <p className="text-sm text-red-800">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg border border-red-300 bg-brand-50 px-4 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
        >
          Try again
        </button>
      )}
    </div>
  );
}
