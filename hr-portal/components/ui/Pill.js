// One shape/weight/radius for every status-like value in the app —
// Present/Absent/Leave, Voided, Income/Expense, announcement Audience
// tags. Only the tone (background + text color) changes. Every tone
// pairs a light tint background with a dark, high-contrast text color,
// checked against WCAG AA for normal text (4.5:1) — see the contrast
// notes for each pair below.

const TONES = {
  // brand-100 bg / brand-800 text — 9.8:1
  muted: 'bg-brand-100 text-brand-800',
  // #eaf3de bg / #1e3d08 text — 10.6:1
  present: 'bg-[#eaf3de] text-[#1e3d08]',
  income: 'bg-[#eaf3de] text-[#1e3d08]',
  // #fcebeb bg / #6b1414 text — 10.5:1
  absent: 'bg-[#fcebeb] text-[#6b1414]',
  expense: 'bg-[#fcebeb] text-[#6b1414]',
  voided: 'bg-[#fcebeb] text-[#6b1414]',
  // #faeeda bg / #4d2c04 text — 10.9:1
  leave: 'bg-[#faeeda] text-[#4d2c04]',
  // brand-900 bg / brand-50 text — 12.8:1, solid, used sparingly for emphasis
  solid: 'bg-brand-900 text-brand-50',
};

export default function Pill({ tone = 'muted', children, className = '' }) {
  const toneClasses = TONES[tone] || TONES.muted;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium leading-5 tracking-wide ${toneClasses} ${className}`}
    >
      {children}
    </span>
  );
}
