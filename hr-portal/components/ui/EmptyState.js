// An empty screen should read as an invitation to act, not a dead end —
// icon + a direct next step, not just "no data yet" text.

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction, className = '' }) {
  return (
    <div className={`col-span-full flex flex-col items-center rounded-xl border border-dashed border-brand-300 bg-white px-6 py-12 text-center ${className}`}>
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
          <Icon size={22} className="text-brand-500" aria-hidden="true" />
        </div>
      )}
      <p className="mt-4 font-serif text-lg font-semibold text-brand-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-brand-500">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 rounded-lg bg-brand-900 px-5 py-2.5 text-sm font-medium text-brand-50 hover:bg-brand-800"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
