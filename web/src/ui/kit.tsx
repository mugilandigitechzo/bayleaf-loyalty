import { useEffect, useId, useRef, useState, createContext, useContext, useCallback } from 'react';
import { Alert, Check, Close, Info, Leaf } from './icons.tsx';
import { t } from '../i18n/index.ts';

// ---------------------------------------------------------------------------
export function Wordmark({ large, onDark, name = 'Bay Leaf' }: { large?: boolean; onDark?: boolean; name?: string }) {
  // Temporary wordmark. Replace with Bay Leaf's supplied logo by swapping this component.
  return (
    <span className={`wordmark${large ? ' wordmark--large' : ''}${onDark ? ' wordmark--on-dark' : ''}`}>
      <Leaf className="wordmark__leaf" />
      <span className="wordmark__text">{name}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
type BtnProps = {
  children?: any; variant?: 'primary' | 'gold' | 'secondary' | 'ghost' | 'danger' | 'whatsapp';
  size?: 'sm' | 'md' | 'xl'; block?: boolean; loading?: boolean; className?: string;
  type?: 'button' | 'submit'; disabled?: boolean; onClick?: (e: any) => void; href?: string; target?: string; rel?: string;
  'aria-label'?: string; autoFocus?: boolean;
};
export function Button({ children, variant = 'primary', size = 'md', block, loading, className = '', type = 'button', disabled, onClick, href, ...rest }: BtnProps) {
  const cls = `btn btn--${variant}${size !== 'md' ? ` btn--${size}` : ''}${block ? ' btn--block' : ''} ${className}`;
  if (href) return <a className={cls} href={href} onClick={onClick} {...rest}>{children}</a>;
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} onClick={onClick} {...rest}>
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
type FieldProps = {
  label: string; hint?: string; error?: string; value: string; onChange: (v: string) => void;
  type?: string; inputMode?: string; autoComplete?: string; placeholder?: string; autoFocus?: boolean;
  maxLength?: number; required?: boolean; prefix?: string; className?: string; name?: string; dir?: string;
};
export function Field({ label, hint, error, value, onChange, prefix, className = '', ...rest }: FieldProps) {
  const id = useId();
  const input = (
    <input
      id={id} className={`input ${className}`} value={value}
      onChange={(e: any) => onChange(e.target.value)}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={[hint ? id + '-h' : '', error ? id + '-e' : ''].filter(Boolean).join(' ') || undefined}
      {...rest}
    />
  );
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      {prefix ? <div className="phone-input"><span className="phone-input__cc">{prefix}</span>{input}</div> : input}
      {hint && !error ? <span id={id + '-h'} className="field__hint">{hint}</span> : null}
      {error ? <span id={id + '-e'} className="field__error" role="alert">{error}</span> : null}
    </div>
  );
}

const CC: Record<string, string> = { AE: '+971', SA: '+966', QA: '+974', KW: '+965', BH: '+973', OM: '+968', IN: '+91' };
export function PhoneField(p: Omit<FieldProps, 'type' | 'inputMode' | 'prefix'> & { region?: string }) {
  return <Field {...p} type="tel" inputMode="tel" autoComplete="tel" prefix={CC[p.region ?? 'AE']} dir="ltr" />;
}

// ---------------------------------------------------------------------------
export function Notice({ kind = 'info', children }: { kind?: 'info' | 'error' | 'success' | 'warn'; children: any }) {
  const Icon = kind === 'success' ? Check : kind === 'info' ? Info : Alert;
  return (
    <div className={`notice notice--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon /><div>{children}</div>
    </div>
  );
}

export function Skeleton({ h = 20, w = '100%', r }: { h?: number | string; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
/** Modal sheet: bottom sheet on phones, centred dialog on larger screens. */
export function Sheet({ title, onClose, children, actions, labelledBy }: { title: string; onClose: () => void; children?: any; actions?: any; labelledBy?: string }) {
  const id = useId();
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    const focusables = () => Array.from(el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((x) => !x.hasAttribute('disabled'));
    (el.querySelector<HTMLElement>('[autofocus]') ?? focusables()[0] ?? el).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab') {
        const f = focusables(); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; prev?.focus?.(); };
  }, []);
  return (
    <div className="overlay" onMouseDown={(e: any) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? id} ref={ref} tabIndex={-1}>
        <div className="sheet__head">
          <h2 className="sheet__title" id={id}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><Close /></button>
        </div>
        {children}
        {actions ? <div className="sheet__actions">{actions}</div> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
type ToastItem = { id: number; text: string; kind: 'info' | 'error' };
const ToastCtx = createContext<(text: string, kind?: 'info' | 'error') => void>(() => {});
export function ToastProvider({ children }: { children: any }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, kind: 'info' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, kind }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((i) => <div key={i.id} className={`toast${i.kind === 'error' ? ' toast--error' : ''}`}>{i.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------------------------------------------------------------------------
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

export function OfflineBar({ text }: { text: string }) {
  const online = useOnline();
  return online ? null : <div className="offline-bar" role="status">{text}</div>;
}

/** Fetch-on-mount with loading / error / reload. */
export function useLoad<T>(load: () => Promise<T>, deps: readonly unknown[] = []) {
  const [state, setState] = useState<{ data: T | null; error: any; loading: boolean }>({ data: null, error: null, loading: true });
  const seq = useRef(0);
  const run = useCallback(() => {
    const n = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    load().then(
      (data) => { if (n === seq.current) setState({ data, error: null, loading: false }); },
      (error) => { if (n === seq.current) setState((s) => ({ data: s.data, error, loading: false })); },
    );
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run, setData: (d: T) => setState({ data: d, error: null, loading: false }) };
}
