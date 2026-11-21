import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { countdown } from '../lib/time';

/* ---------- icons (inline, stroke) ---------- */
const P = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
export const Icon = {
  chart: P(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>),
  home: P(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-5h4v5" /></>),
  plus: P(<><path d="M12 5v14M5 12h14" /></>),
  calendar: P(<><rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M3 9.5h18M8 3v3M16 3v3" /></>),
  chat: P(<><path d="M4 5h16v11H8l-4 4z" /></>),
  users: P(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.4 3.5 5.2" /></>),
  settings: P(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>),
  phone: P(<><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></>),
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.5-.3z" /></svg>
  ),
  gift: P(<><rect x="3" y="8" width="18" height="5" rx="1" /><path d="M5 13v8h14v-8M12 8v13M12 8S10.5 3.5 8 4.5 8.5 8 12 8zm0 0s1.5-4.5 4-3.5S15.5 8 12 8z" /></>),
  check: P(<path d="m5 12.5 4.5 4.5L19 7.5" />),
  x: P(<path d="M6 6l12 12M18 6 6 18" />),
  bell: P(<><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
  card: P(<><rect x="2.5" y="5" width="19" height="14" rx="3" /><path d="M2.5 10h19M6.5 15h4" /></>),
  back: P(<path d="m9 6 6 6-6 6" />),
  share: P(<><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5" /><path d="M5 12v8h14v-8" /></>),
  logout: P(<><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></>),
  apple: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5a4.3 4.3 0 0 0-3.4-1.8c-1.4-.2-2.8.8-3.5.8s-1.9-.8-3.1-.8a4.6 4.6 0 0 0-3.9 2.4c-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.8 2.5 3 2.4s1.7-.8 3.1-.8 1.9.8 3.1.8 2.1-1.2 2.8-2.4a9.7 9.7 0 0 0 1.3-2.6 4 4 0 0 1-2.6-4.1zM14.1 5.6A4 4 0 0 0 15 2.7a4.1 4.1 0 0 0-2.7 1.4 3.9 3.9 0 0 0-1 2.8 3.4 3.4 0 0 0 2.8-1.3z" /></svg>
  ),
  google: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2a9.8 9.8 0 0 0 3-7.3z" /><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5a6 6 0 0 1-9-3.1H3.1v2.6A10 10 0 0 0 12 22z" /><path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" /><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.9 1.5l2.8-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6A6 6 0 0 1 12 6z" /></svg>
  ),
};

/* ---------- data loading hook ---------- */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    fn().then((d) => alive && setData(d)).catch((e) => alive && setError(String(e.message ?? e)));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload };
}

/* ---------- toast ---------- */
const ToastCtx = createContext<(msg: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <ToastCtx.Provider value={setMsg}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- sheet ---------- */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="grab" />
        {children}
      </div>
    </div>
  );
}

/* ---------- countdown ---------- */
export function CountdownView({ target }: { target: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const c = countdown(target, now);
  const cells: [number, string][] = [[c.days, 'يوم'], [c.hours, 'ساعة'], [c.minutes, 'دقيقة'], [c.seconds, 'ثانية']];
  return (
    <div className="countdown" aria-label="الوقت المتبقي للموعد">
      {cells.map(([v, l]) => (
        <div key={l}><b>{String(v).padStart(2, '0')}</b><span>{l}</span></div>
      ))}
    </div>
  );
}

/* ---------- loyalty ---------- */
export function LoyaltyCard({ visits, target, reward }: { visits: number; target: number; reward: string }) {
  const inCycle = visits % target;
  const nextFree = inCycle === target - 1;
  const left = target - 1 - inCycle;
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700 }}>بطاقة الزيارات</div>
          <div className="hint">{reward}</div>
        </div>
        {nextFree ? <span className="tag gift">زيارتك القادمة هدية</span> : <span className="tag">بقي {left} {left === 1 ? 'زيارة' : 'زيارات'}</span>}
      </div>
      <div className="stamps" style={{ gridTemplateColumns: `repeat(${Math.min(target, 5)}, 1fr)` }}>
        {Array.from({ length: target }, (_, i) => {
          const isGift = i === target - 1;
          const on = i < inCycle;
          return (
            <div key={i} className={`stamp${on ? ' on' : ''}${isGift ? ' gift' : ''}`}>
              {isGift ? Icon.gift : on ? Icon.check : i + 1}
            </div>
          );
        })}
      </div>
      <div className="hint" style={{ marginTop: 10 }}>مجموع زياراتك: {visits}</div>
    </div>
  );
}

/* ---------- tab bar ---------- */
export interface Tab { to: string; label: string; icon: ReactNode; badge?: number; cta?: boolean; end?: boolean }
export function TabBar({ tabs }: { tabs: Tab[] }) {
  return (
    <div className="tabbar">
      <nav>
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : t.cta ? 'cta' : '')}>
            {t.icon}
            {t.label}
            {!!t.badge && <span className="badge">{t.badge}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="switch" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i />
    </label>
  );
}

export const initials = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('');
