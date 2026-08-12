'use client';

import { useRef } from 'react';

// The one true celebration moment in the app — fires exactly once, here,
// on a successful QR check-in, nowhere else. Hand-rolled, zero dependency.
const COLORS = ['#b9954f', '#7d5a2c', '#27500a', '#d4b878', '#9c7539'];

export default function Confetti({ burstKey }) {
  const pieces = useRef(
    Array.from({ length: 28 }, (_, i) => ({
      id: i,
      left: 50 + (Math.random() - 0.5) * 55,
      delay: Math.random() * 0.15,
      color: COLORS[i % COLORS.length],
      dx: (Math.random() - 0.5) * 180,
      rot: Math.round(Math.random() * 360),
    }))
  ).current;

  if (!burstKey) return null;

  return (
    <div key={burstKey} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="nxc-confetti-piece absolute top-1/3 h-2.5 w-2 rounded-sm"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rot}deg)`,
            '--dx': `${p.dx}px`,
          }}
        />
      ))}
    </div>
  );
}
