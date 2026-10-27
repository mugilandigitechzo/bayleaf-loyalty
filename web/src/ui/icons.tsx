/* Inline icon set: 24px grid, 1.75 stroke, rounded joins. Decorative by default (aria-hidden). */
type P = { className?: string; title?: string };
const base = (title?: string) => ({
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': title ? undefined : true, role: title ? 'img' : undefined, 'aria-label': title,
});

/** The Bay Leaf mark: a single bay leaf with its midrib. */
export const LEAF_PATH = 'M12 2.5C7.2 5.6 5 10.2 6 15.4c.6 3.1 2.8 5.2 6 6.1 3.2-.9 5.4-3 6-6.1 1-5.2-1.2-9.8-6-12.9Z';
export function Leaf({ className, title }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} aria-label={title}>
      <g transform="rotate(28 12 12)">
        <path d={LEAF_PATH} fill="currentColor" />
        <path d="M12 6.5v14" stroke="var(--leaf-rib, rgba(0,0,0,.28))" strokeWidth="1.1" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}

/** Eight-point star (khatam) used for reward milestones. */
export function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 8) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

export const Star = ({ className, filled }: P & { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <polygon points={starPoints(12, 12, 11, 8.6)} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

export const Gift = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><rect x="3.5" y="8" width="17" height="4" rx="1" /><path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3-5-3.5-5-1.2C7 8 9.5 8 12 8Zm0 0c1.5-3 5-3.5 5-1.2C17 8 14.5 8 12 8Z" /></svg>
);
export const Qr = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><rect x="3.5" y="3.5" width="6" height="6" rx="1" /><rect x="14.5" y="3.5" width="6" height="6" rx="1" /><rect x="3.5" y="14.5" width="6" height="6" rx="1" /><path d="M14.5 14.5h2.5v2.5M20.5 14.5v.01M14.5 20.5h.01M17.5 20.5h3v-3" /></svg>
);
export const Scan = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16" /></svg>
);
export const Search = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
);
export const Check = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const Close = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const Back = ({ className, title }: P) => (
  <svg {...base(title)} className={className} style={{ transform: 'scaleX(var(--dir-flip, 1))' }}><path d="M15 5l-7 7 7 7" /></svg>
);
export const Lock = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><rect x="5" y="11" width="14" height="9.5" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
export const Clock = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);
export const Alert = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" /><path d="M12 10v4M12 17v.01" /></svg>
);
export const Info = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.01" /></svg>
);
export const Share = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><path d="M12 3.5v11M8 7.5l4-4 4 4M6 11.5H5a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 5 20.5h14a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5h-1" /></svg>
);
export const Whatsapp = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
    <path d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.7l5-1.3A9.7 9.7 0 1 0 12 2.2Zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.7-1.3.1-.1 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.9 2c0 1.2.9 2.4 1 2.5.1.2 1.7 2.7 4.2 3.8 1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.2.2-.6.2-1 .1-1.2l-.4-.3Z" />
  </svg>
);
export const User = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20.5c1-3.6 4-5.5 7.5-5.5s6.5 1.9 7.5 5.5" /></svg>
);
export const UserPlus = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><circle cx="10" cy="8" r="3.6" /><path d="M3.5 20c.9-3.4 3.6-5.2 6.5-5.2 1.3 0 2.5.3 3.5 1M18 13v6M15 16h6" /></svg>
);
export const Users = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><circle cx="9" cy="8.5" r="3.3" /><path d="M3 19.5c.8-3 3.2-4.6 6-4.6s5.2 1.6 6 4.6M15.5 5.6a3.2 3.2 0 0 1 0 6M17.5 15.3c1.7.6 3 2 3.5 4.2" /></svg>
);
export const CardIcon = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18M7 15h4" /></svg>
);
export const Gauge = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><path d="M4 19.5V10M10 19.5V5M16 19.5v-7M21 19.5H3" /></svg>
);
export const Cog = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V20a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H10a1.6 1.6 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V10a1.6 1.6 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></svg>
);
export const ListIcon = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" /></svg>
);
export const Logout = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><path d="M14 4.5h4a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-4M10 16.5 5.5 12 10 7.5M5.5 12H15" /></svg>
);
export const Plus = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><path d="M12 5v14M5 12h14" /></svg>
);
export const Store = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><path d="M4 9.5 5.5 4h13L20 9.5M4 9.5h16M4 9.5c0 1.5 1.2 2.5 2.7 2.5S9.3 11 9.3 9.5c0 1.5 1.2 2.5 2.7 2.5s2.7-1 2.7-2.5c0 1.5 1.2 2.5 2.6 2.5S20 11 20 9.5M5.5 12v8h13v-8M10 20v-4.5h4V20" /></svg>
);
export const Undo = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><path d="M8.5 7 4.5 11l4 4M4.5 11H15a4.5 4.5 0 0 1 0 9h-2" /></svg>
);
export const Edit = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4" /></svg>
);
export const Counter = ({ className, title }: P) => (
  <svg {...base(title)} className={className}><rect x="3.5" y="4" width="17" height="11" rx="2" /><path d="M8 19.5h8M12 15v4.5" /></svg>
);
