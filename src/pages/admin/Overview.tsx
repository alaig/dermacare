import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Icon, useLoad } from '../../components/ui';
import { DAY_NAMES, addDays, fmtDate, fmtTime, sameDay, startOfDay } from '../../lib/time';
import { whatsappUrl } from '../../lib/calendar';
import type { AppointmentFull, ApptStatus, Treatment } from '../../lib/types';
import { useAdmin } from './AdminApp';

// Categorical slots (validated: adjacent CVD ΔE >= 9.1, normal-vision >= 19.6 on the card surface).
// Light slots sit below 3:1 contrast, so every slice also has its name, count and share printed in the list.
const SLOTS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'];
const OTHER = '#5e5a56';
const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];

const STATUS: Record<ApptStatus, [string, string]> = {
  pending: ['بانتظار التأكيد', 'warn'],
  booked: ['محجوز', ''],
  completed: ['تمّ', 'ok'],
  cancelled: ['ملغى', 'red'],
  no_show: ['لم تحضر', 'warn'],
};

const live = (a: AppointmentFull) => a.status !== 'cancelled';

export default function Overview() {
  const { settings: s } = useAdmin();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const monthStart = new Date(ym.y, ym.m, 1);
  const monthEnd = new Date(ym.y, ym.m + 1, 1);
  const shift = (d: number) => setYm(({ y, m }) => { const x = new Date(y, m + d, 1); return { y: x.getFullYear(), m: x.getMonth() }; });

  const { data } = useLoad(async () => {
    const [appts, treatments, clients] = await Promise.all([
      api.listAppointments(monthStart.toISOString(), monthEnd.toISOString()),
      api.listTreatments(true),
      api.listClients(),
    ]);
    return { appts, treatments, clients };
  }, [ym.y, ym.m]);

  const today = startOfDay(now);
  const { data: week } = useLoad(() => api.listAppointments(today.toISOString(), addDays(today, 7).toISOString()), []);

  const appts = data?.appts.filter(live) ?? [];
  const completed = appts.filter((a) => a.status === 'completed');
  const revenue = completed.reduce((sum, a) => sum + (a.treatment.price ?? 0), 0);
  const noShow = appts.filter((a) => a.status === 'no_show').length;
  const newClients = data?.clients.filter((c) => { const d = new Date(c.createdAt); return d >= monthStart && d < monthEnd; }).length ?? 0;
  const pendingClients = data?.clients.filter((c) => !c.approved).length ?? 0;
  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 2 + i);
  const isFuture = monthStart > now;

  return (
    <>
      <header className="topbar">
        <div className="hello">لوحة الإدارة<b>نظرة عامة</b></div>
        <img src="/mark.svg" alt="" style={{ height: 36 }} />
      </header>

      {pendingClients > 0 && (
        <Link to="/admin/clients?f=pending" className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', background: 'var(--warn-bg)', boxShadow: 'none', marginBottom: 12 }}>
          <span className="avatar" style={{ background: '#fff', color: 'var(--warn)' }}>{pendingClients}</span>
          <span style={{ flex: 1, color: 'var(--warn)', fontWeight: 600 }}>{pendingClients === 1 ? 'زبونة جديدة بانتظار التأكيد' : 'زبائن جدد بانتظار التأكيد'}</span>
          <span style={{ width: 20, color: 'var(--warn)', transform: 'scaleX(-1)' }}>{Icon.back}</span>
        </Link>
      )}

      {/* ---- this week ---- */}
      <div className="section-title" style={{ marginTop: 4 }}>مواعيد الأيام السبعة القادمة</div>
      <WeekList appts={week?.filter(live) ?? null} centerName={s.centerName} />

      {/* ---- month filter: one row, drives everything below ---- */}
      <div className="section-title" style={{ marginTop: 26 }}>تحليل الشهر</div>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10 }}>
        <button className="btn soft sm" aria-label="الشهر السابق" onClick={() => shift(-1)} style={{ padding: '0 10px' }}><span style={{ width: 18, display: 'block' }}>{Icon.back}</span></button>
        <select className="input" style={{ minHeight: 38, padding: '6px 10px', fontSize: 15 }} value={ym.m} onChange={(e) => setYm({ ...ym, m: Number(e.target.value) })} aria-label="الشهر">
          {MONTHS.map((n, i) => <option key={n} value={i}>{n}</option>)}
        </select>
        <select className="input" style={{ minHeight: 38, padding: '6px 10px', fontSize: 15, width: 96, flex: 'none' }} value={ym.y} onChange={(e) => setYm({ ...ym, y: Number(e.target.value) })} aria-label="السنة">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="btn soft sm" aria-label="الشهر التالي" onClick={() => shift(1)} style={{ padding: '0 10px' }}><span style={{ width: 18, display: 'block', transform: 'scaleX(-1)' }}>{Icon.back}</span></button>
      </div>
      {(ym.y !== now.getFullYear() || ym.m !== now.getMonth()) && (
        <button className="btn sm" style={{ background: 'none', color: 'var(--coral-deep)', minHeight: 30, padding: '4px 0' }} onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })}>العودة لهذا الشهر</button>
      )}

      {!data ? <div className="hint" style={{ padding: 16 }}>جارٍ التحميل…</div> : (
        <>
          <div className="grid2" style={{ marginTop: 12 }}>
            <div className="stat"><b>{appts.length}</b><span>{isFuture ? 'مواعيد محجوزة' : 'مواعيد (بدون الملغاة)'}</span></div>
            <div className="stat"><b>{completed.length}</b><span>زيارات تمّت</span></div>
            <div className="stat"><b>₪{revenue.toLocaleString('en')}</b><span>دخل تقديري (من الزيارات التي تمّت)</span></div>
            <div className="stat"><b>{newClients}</b><span>زبائن جدد</span></div>
          </div>
          {noShow > 0 && <p className="hint" style={{ margin: '8px 4px 0' }}>لم تحضر: {noShow} ({Math.round((noShow / appts.length) * 100)}٪ من المواعيد)</p>}

          <div className="section-title">أكثر العلاجات طلبًا</div>
          <TreatmentDonut appts={appts} treatments={data.treatments} />

          <div className="section-title">أكثر ساعات الحجز</div>
          <HoursChart appts={appts} />

          <div className="section-title">رزنامة {MONTHS[ym.m]} {ym.y}</div>
          <MonthCalendar y={ym.y} m={ym.m} appts={appts} centerName={s.centerName} />
        </>
      )}
    </>
  );
}

/* ---------------- donut ---------------- */
function TreatmentDonut({ appts, treatments }: { appts: AppointmentFull[]; treatments: Treatment[] }) {
  const [hi, setHi] = useState<string | null>(null);
  // colour follows the treatment (its place in the treatments list), never its rank this month
  const colorOf = useMemo(() => new Map(treatments.slice(0, SLOTS.length).map((t, i) => [t.id, SLOTS[i]])), [treatments]);
  const parts = useMemo(() => {
    const counts = new Map<string, number>();
    appts.forEach((a) => counts.set(a.treatmentId, (counts.get(a.treatmentId) ?? 0) + 1));
    const own: { id: string; name: string; n: number; color: string }[] = [];
    let other = 0;
    counts.forEach((n, id) => {
      const color = colorOf.get(id);
      if (color) own.push({ id, name: treatments.find((t) => t.id === id)?.name ?? '—', n, color });
      else other += n;
    });
    own.sort((a, b) => b.n - a.n);
    if (other) own.push({ id: 'other', name: 'أخرى', n: other, color: OTHER });
    return own;
  }, [appts, colorOf, treatments]);
  const total = parts.reduce((s, p) => s + p.n, 0);

  if (!total) return <div className="card empty">لا توجد مواعيد في هذا الشهر</div>;

  // geometry
  const R = 70, r = 46, C = 90;
  let acc = 0;
  const arcs = parts.map((p) => {
    const a0 = (acc / total) * Math.PI * 2; acc += p.n; const a1 = (acc / total) * Math.PI * 2;
    return { ...p, a0, a1 };
  });
  const pt = (rad: number, a: number) => [C + rad * Math.sin(a), C - rad * Math.cos(a)];
  const path = (a0: number, a1: number) => {
    if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [x2, y2] = pt(r, a1), [x3, y3] = pt(r, a0);
    return `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${large} 0 ${x3},${y3} Z`;
  };
  const focus = parts.find((p) => p.id === hi) ?? parts[0];

  return (
    <div className="card">
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <svg viewBox="0 0 180 180" width="150" height="150" role="img" aria-label="توزيع العلاجات" style={{ flex: 'none' }}>
          {arcs.map((a) => (
            <path key={a.id} d={path(a.a0, a.a1)} fill={a.color} stroke="var(--card)" strokeWidth={2} strokeLinejoin="round"
              opacity={hi && hi !== a.id ? 0.35 : 1} style={{ cursor: 'pointer', transition: 'opacity .15s' }}
              onMouseEnter={() => setHi(a.id)} onMouseLeave={() => setHi(null)} onClick={() => setHi(hi === a.id ? null : a.id)}>
              <title>{`${a.name}: ${a.n} (${Math.round((a.n / total) * 100)}٪)`}</title>
            </path>
          ))}
          <text x={C} y={C - 4} textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--navy)">{Math.round((focus.n / total) * 100)}٪</text>
          <text x={C} y={C + 16} textAnchor="middle" fontSize="10.5" fill="var(--muted)">{hi ? focus.name.slice(0, 14) : 'الأكثر طلبًا'}</text>
        </svg>
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
          {parts.map((p) => (
            <button key={p.id} onClick={() => setHi(hi === p.id ? null : p.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, border: 0, background: hi === p.id ? 'var(--blush)' : 'none', borderRadius: 8, padding: '5px 6px', textAlign: 'start', cursor: 'pointer', fontSize: 13.5 }}>
              <i style={{ width: 10, height: 10, borderRadius: 3, background: p.color, flex: 'none' }} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--navy)' }}>{p.name}</span>
              <b style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--navy)' }}>{p.n}</b>
              <span style={{ color: 'var(--muted)', width: 34, textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>{Math.round((p.n / total) * 100)}٪</span>
            </button>
          ))}
        </div>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>مجموع {total} مواعيد (بدون الملغاة)</p>
    </div>
  );
}

/* ---------------- busiest hours ---------------- */
function HoursChart({ appts }: { appts: AppointmentFull[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const byHour = new Map<number, number>();
  appts.forEach((a) => { const h = new Date(a.start).getHours(); byHour.set(h, (byHour.get(h) ?? 0) + 1); });
  if (!byHour.size) return <div className="card empty">لا توجد بيانات لهذا الشهر</div>;
  const hours = [...byHour.keys()];
  const h0 = Math.min(...hours), h1 = Math.max(...hours);
  const range = Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i);
  const max = Math.max(...byHour.values());
  const peak = range.filter((h) => byHour.get(h) === max);
  const W = 320, H = 150, padB = 22, padT = 18;
  const bw = W / range.length;
  const label = (h: number) => `${String(h).padStart(2, '0')}:00`;
  const shown = sel ?? peak[0];

  return (
    <div className="card">
      <p style={{ marginBottom: 10, fontSize: 14 }}>
        {sel === null ? <>الذروة: <b>{peak.map(label).join('، ')}</b> · {max} {max === 1 ? 'موعد' : 'مواعيد'}</>
          : <><b>{label(sel)}</b> · {byHour.get(sel) ?? 0} مواعيد</>}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="عدد المواعيد حسب الساعة" style={{ display: 'block', direction: 'ltr' }}>
        <line x1="0" x2={W} y1={H - padB} y2={H - padB} stroke="var(--line)" />
        {range.map((h, i) => {
          const n = byHour.get(h) ?? 0;
          const bh = n ? Math.max(4, ((H - padB - padT) * n) / max) : 0;
          const x = i * bw + 3, w = Math.max(4, bw - 6);
          const on = h === shown;
          return (
            <g key={h} onClick={() => setSel(sel === h ? null : h)} onMouseEnter={() => setSel(h)} onMouseLeave={() => setSel(null)} style={{ cursor: 'pointer' }}>
              <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
              {n > 0 && <path d={`M${x},${H - padB} V${H - padB - bh + 4} q0,-4 4,-4 h${w - 8} q4,0 4,4 V${H - padB} Z`} fill={on ? 'var(--navy)' : 'var(--rose)'} />}
              {on && n > 0 && <text x={x + w / 2} y={H - padB - bh - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--navy)">{n}</text>}
              {(range.length <= 8 || i % 2 === 0) && <text x={i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">{h}</text>}
              <title>{`${label(h)}: ${n}`}</title>
            </g>
          );
        })}
      </svg>
      <p className="hint" style={{ marginTop: 4 }}>الساعة (بداية الموعد)</p>
    </div>
  );
}

/* ---------------- month calendar ---------------- */
function MonthCalendar({ y, m, appts, centerName }: { y: number; m: number; appts: AppointmentFull[]; centerName: string }) {
  const first = new Date(y, m, 1);
  const days = new Date(y, m + 1, 0).getDate();
  const lead = first.getDay(); // Sunday first
  const byDay = new Map<number, AppointmentFull[]>();
  appts.forEach((a) => { const d = new Date(a.start).getDate(); byDay.set(d, [...(byDay.get(d) ?? []), a]); });
  const max = Math.max(1, ...[...byDay.values()].map((v) => v.length));
  const today = new Date();
  const [sel, setSel] = useState<number | null>(null);
  const selList = sel ? (byDay.get(sel) ?? []).slice().sort((a, b) => a.start.localeCompare(b.start)) : [];

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
        {['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].map((d) => <div key={d} style={{ fontSize: 10.5, color: 'var(--muted)', padding: '2px 0 6px' }}>{d}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={'e' + i} />)}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const n = byDay.get(d)?.length ?? 0;
          const isToday = sameDay(new Date(y, m, d), today);
          const on = sel === d;
          // sequential: one hue (coral), more appointments = stronger
          const bg = on ? 'var(--navy)' : n ? `rgba(236,103,102,${0.14 + 0.56 * (n / max)})` : 'transparent';
          return (
            <button key={d} onClick={() => setSel(on ? null : d)} aria-label={`${d}: ${n} مواعيد`}
              style={{ aspectRatio: '1', border: 0, borderRadius: 10, background: bg, color: on ? '#fff' : 'var(--navy)', cursor: 'pointer', position: 'relative',
                boxShadow: isToday && !on ? 'inset 0 0 0 1.5px var(--navy)' : 'none', display: 'grid', placeItems: 'center', padding: 0, fontSize: 14, fontWeight: isToday ? 700 : 500 }}>
              {d}
              {n > 0 && <span style={{ position: 'absolute', bottom: 2, fontSize: 9.5, fontWeight: 700, color: on ? '#fff' : 'var(--navy)', opacity: 0.85 }}>{n}</span>}
            </button>
          );
        })}
      </div>
      <p className="hint" style={{ marginTop: 8 }}>الرقم الصغير = عدد المواعيد. كلما كان اللون أغمق، كان اليوم أكثر ازدحامًا. اضغطي على يوم لعرض مواعيده.</p>
      {sel && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{fmtDate(new Date(y, m, sel).toISOString())}</div>
          {selList.length === 0 ? <div className="hint">لا توجد مواعيد</div> : (
            <div className="list" style={{ boxShadow: 'none', border: '1px solid var(--blush-2)' }}>
              {selList.map((a) => <ApptRow key={a.id} a={a} centerName={centerName} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- next 7 days ---------------- */
function WeekList({ appts, centerName }: { appts: AppointmentFull[] | null; centerName: string }) {
  const [all, setAll] = useState(false);
  const [by, setBy] = useState<'day' | 'client'>('day');
  const LIMIT = 6;
  if (!appts) return <div className="hint" style={{ padding: 12 }}>جارٍ التحميل…</div>;
  if (!appts.length) return <div className="card empty">لا توجد مواعيد في الأيام السبعة القادمة</div>;
  const groups = new Map<string, AppointmentFull[]>();
  const sorted = appts.slice().sort((a, b) => a.start.localeCompare(b.start));
  sorted.slice(0, all ? undefined : LIMIT).forEach((a) => {
    const k = startOfDay(new Date(a.start)).toISOString();
    groups.set(k, [...(groups.get(k) ?? []), a]);
  });
  const today = startOfDay(new Date());
  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    return sameDay(d, today) ? 'اليوم' : sameDay(d, addDays(today, 1)) ? 'غدًا' : DAY_NAMES[d.getDay()];
  };
  const toggle = (
    <div className="chips" style={{ margin: '0 0 6px', padding: 0 }}>
      <button className={`chip${by === 'day' ? ' on' : ''}`} onClick={() => setBy('day')}>حسب اليوم</button>
      <button className={`chip${by === 'client' ? ' on' : ''}`} onClick={() => setBy('client')}>حسب الزبون</button>
    </div>
  );

  if (by === 'client') {
    const byClient = new Map<string, AppointmentFull[]>();
    sorted.forEach((a) => byClient.set(a.clientId, [...(byClient.get(a.clientId) ?? []), a]));
    const clients = [...byClient.values()].sort((a, b) => b.length - a.length || a[0].start.localeCompare(b[0].start));
    const shown = all ? clients : clients.slice(0, LIMIT);
    return (
      <>
        {toggle}
        {shown.map((list) => {
          const c = list[0].client;
          const wa = whatsappUrl('972' + c.phone.slice(1), `مرحبًا ${c.name.split(' ')[0]}، تذكير بمواعيدك في ${centerName} هذا الأسبوع:\n` +
            list.map((a) => `• ${a.treatment.name}: ${dayLabel(a.start)} ${fmtDate(a.start)} الساعة ${fmtTime(a.start)}`).join('\n'));
          return (
            <div className="card" key={c.id} style={{ padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Link to={`/admin/clients?c=${c.id}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}>
                  <div style={{ fontWeight: 700 }}>{c.name} <span className="tag" style={{ marginInlineStart: 4 }}>{list.length} {list.length === 1 ? 'موعد' : 'مواعيد'}</span></div>
                  <div className="hint" dir="ltr" style={{ textAlign: 'right' }}>{c.phone}</div>
                </Link>
                <a className="btn ghost sm" href={`tel:${c.phone}`} aria-label="اتصال" style={{ padding: '0 10px' }}>{Icon.phone}</a>
                <a className="btn ghost sm" href={wa} target="_blank" rel="noreferrer" aria-label="واتساب" style={{ padding: '0 10px', color: '#1f9d55' }}>{Icon.whatsapp}</a>
              </div>
              <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                {list.map((a) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--blush-2)', borderRadius: 12, padding: '8px 10px' }}>
                    <div style={{ width: 74, flex: 'none', fontSize: 13 }}>
                      <b style={{ display: 'block' }}>{dayLabel(a.start)}</b>
                      <span className="hint" style={{ fontSize: 12 }}>{fmtTime(a.start)}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 14 }}>{a.treatment.name}<span className="hint" style={{ fontSize: 12 }}> · {a.treatment.durationMin} د</span></div>
                    {a.status !== 'booked' && <span className={`tag ${STATUS[a.status][1]}`}>{STATUS[a.status][0]}</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {clients.length > LIMIT && (
          <button className="btn soft block" onClick={() => setAll(!all)}>{all ? 'عرض أقل' : `عرض كل الزبائن (${clients.length})`}</button>
        )}
      </>
    );
  }

  return (
    <>
      {toggle}
      {[...groups.entries()].map(([k, list]) => {
        const d = new Date(k);
        const label = sameDay(d, today) ? 'اليوم' : sameDay(d, addDays(today, 1)) ? 'غدًا' : DAY_NAMES[d.getDay()];
        return (
          <div key={k} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, margin: '6px 4px', color: 'var(--navy-2)' }}>
              {label} · <span style={{ fontWeight: 500, color: 'var(--muted)' }}>{fmtDate(k)}</span>
            </div>
            <div className="list">{list.map((a) => <ApptRow key={a.id} a={a} centerName={centerName} />)}</div>
          </div>
        );
      })}
      {sorted.length > LIMIT && (
        <button className="btn soft block" onClick={() => setAll(!all)}>
          {all ? 'عرض أقل' : `عرض كل مواعيد الأسبوع (${sorted.length})`}
        </button>
      )}
    </>
  );
}

function ApptRow({ a, centerName }: { a: AppointmentFull; centerName: string }) {
  const first = a.client.name.split(' ')[0];
  const wa = whatsappUrl('972' + a.client.phone.slice(1),
    `مرحبًا ${first}، تذكير بموعدك في ${centerName}: ${a.treatment.name} يوم ${fmtDate(a.start)} الساعة ${fmtTime(a.start)}.`);
  return (
    <div className="item" style={{ alignItems: 'flex-start' }}>
      <div className="time-pill">{fmtTime(a.start)}<small>{a.treatment.durationMin} د</small></div>
      <div className="grow">
        <Link to={`/admin/clients?c=${a.clientId}`} className="t" style={{ display: 'block', textDecoration: 'none' }}>{a.client.name}</Link>
        <a href={`tel:${a.client.phone}`} className="s" dir="ltr" style={{ display: 'inline-block', textDecoration: 'none' }}>{a.client.phone}</a>
        <div className="s">{a.treatment.name}{a.treatment.price ? ` · ₪${a.treatment.price}` : ''}{a.prepaid ? ' · مدفوع مسبقًا' : ''}</div>
        <span className={`tag ${STATUS[a.status][1]}`} style={{ marginTop: 6 }}>{STATUS[a.status][0]}</span>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <a className="btn ghost sm" href={`tel:${a.client.phone}`} aria-label="اتصال" style={{ padding: '0 10px' }}>{Icon.phone}</a>
        <a className="btn ghost sm" href={wa} target="_blank" rel="noreferrer" aria-label="واتساب" style={{ padding: '0 10px', color: '#1f9d55' }}>{Icon.whatsapp}</a>
      </div>
    </div>
  );
}
