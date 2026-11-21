import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Icon, Sheet, initials, useLoad, useToast } from '../../components/ui';
import { DAY_NAMES, fmtShortDate, fmtTime } from '../../lib/time';
import { BIRTH_MIN, birthMax, daysToBirthday, fmtBirthday, renderGreeting } from '../../lib/birthday';
import { whatsappUrl } from '../../lib/calendar';
import type { ApptStatus, ClientWithStats } from '../../lib/types';
import { useAdmin } from './AdminApp';

type Filter = 'all' | 'pending' | 'gift' | 'cycle' | 'idle' | 'bday';

export default function Clients() {
  const { settings: s } = useAdmin();
  const { data, reload } = useLoad(() => api.listClients());
  const [q, setQ] = useState('');
  const [params] = useSearchParams();
  const [f, setF] = useState<Filter>((params.get('f') as Filter) || 'all');
  const [sel, setSel] = useState<ClientWithStats | null>(null);
  // /admin/clients?c=<id> opens that client's card directly (links from agenda and overview)
  const openId = params.get('c');
  useEffect(() => {
    if (openId && data) { const c = data.find((x) => x.id === openId); if (c) setSel(c); }
  }, [openId, data]);
  const T = s.loyaltyTarget;
  const idleSince = new Date(Date.now() - 60 * 86_400_000).toISOString();

  const filters: [Filter, string, (c: ClientWithStats) => boolean][] = [
    ['all', 'الكل', () => true],
    ['pending', '⏳ بانتظار التأكيد', (c) => !c.approved],
    ['gift', 'زيارتها القادمة هدية', (c) => c.visits % T === T - 1],
    ['cycle', `أكملت ${T}+`, (c) => c.visits >= T],
    ['bday', '🎂 عيد ميلاد خلال أسبوع', (c) => { const d = daysToBirthday(c.birthDate); return d !== null && d <= 7; }],
    ['idle', 'لم تزر منذ شهرين', (c) => !c.nextAppt && !!c.lastVisit && c.lastVisit < idleSince],
  ];
  const fn = filters.find((x) => x[0] === f)![2];
  const list = (data ?? [])
    .filter(fn)
    .filter((c) => !q || c.name.includes(q) || c.phone.includes(q.replace(/\D/g, '')))
    .sort((a, b) => f === 'bday'
      ? (daysToBirthday(a.birthDate) ?? 999) - (daysToBirthday(b.birthDate) ?? 999)
      : b.visits - a.visits);

  return (
    <>
      <h1 className="page-title">الزبائن {data && <span className="hint" style={{ fontSize: 15 }}>({data.length})</span>}</h1>
      <input className="input" placeholder="بحث بالاسم أو الهاتف" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      <div className="chips">
        {filters.map(([k, label, test]) => (
          <button key={k} className={`chip${f === k ? ' on' : ''}`} onClick={() => setF(k)}>
            {label} {data && <span style={{ opacity: 0.6 }}>· {data.filter(test).length}</span>}
          </button>
        ))}
      </div>
      {!s.loyaltyEnabled && <p className="hint" style={{ margin: '4px 4px 10px' }}>بطاقة الزيارات مخفية حاليًا عن الزبائن (من الإعدادات)</p>}
      {!data ? <div className="hint">جارٍ التحميل…</div> : list.length === 0 ? <div className="card empty">لا نتائج</div> : (
        <div className="list" style={{ marginTop: 6 }}>
          {list.map((c) => {
            const inCycle = c.visits % T;
            return (
              <button key={c.id} className="item" style={{ width: '100%', border: 0, background: 'none', textAlign: 'start', cursor: 'pointer' }} onClick={() => setSel(c)}>
                <span className="avatar">{initials(c.name)}</span>
                <span className="grow">
                  <span className="t" style={{ display: 'block' }}>{c.name}</span>
                  <span className="s" style={{ display: 'block' }}>
                    {daysToBirthday(c.birthDate) === 0 ? '🎂 عيد ميلادها اليوم' : f === 'bday' && c.birthDate ? `🎂 ${fmtBirthday(c.birthDate)} · بعد ${daysToBirthday(c.birthDate)} أيام`
                      : c.nextAppt ? `موعد قادم ${fmtShortDate(c.nextAppt)}` : c.lastVisit ? `آخر زيارة ${fmtShortDate(c.lastVisit)}` : 'لم تزر بعد'}
                  </span>
                  <span className="progress" style={{ display: 'block', marginTop: 8 }}><i style={{ width: `${(inCycle / (T - 1)) * 100}%` }} /></span>
                </span>
                {!c.approved ? <span className="tag warn">جديدة</span> : inCycle === T - 1 ? <span className="tag gift">{Icon.gift}</span> : <span className="tag">{c.visits}</span>}
              </button>
            );
          })}
        </div>
      )}
      <ClientSheet c={sel} onClose={() => setSel(null)} onChanged={reload} />
    </>
  );
}

function ClientSheet({ c, onClose, onChanged }: { c: ClientWithStats | null; onClose: () => void; onChanged: () => void }) {
  const { settings: s } = useAdmin();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [birth, setBirth] = useState('');
  const { data: appts, reload: reloadAppts } = useLoad(() => (c ? api.clientAppointments(c.id) : Promise.resolve([])), [c?.id]);
  const [newPin, setNewPin] = useState('');
  const [sentPin, setSentPin] = useState('');
  const [lastId, setLastId] = useState<string | null>(null);
  if (c && c.id !== lastId) { setLastId(c.id); setBirth(c.birthDate ?? ''); setSentPin(''); setNewPin(''); }
  if (!c) return null;
  const greeting = `${renderGreeting(s.birthdayTitle, c.name, s.birthdayGift)}\n${renderGreeting(s.birthdayBody, c.name, s.birthdayGift)}`;
  const saveBirth = async () => {
    await api.setClientBirthDate(c.id, birth || null);
    toast('تم حفظ تاريخ الميلاد'); onChanged(); onClose();
  };
  const T = s.loyaltyTarget;
  const approve = async () => { await api.approveClient(c.id); toast('تم تأكيد الزبونة'); onChanged(); onClose(); };
  const reject = async () => {
    if (!confirm(`رفض تسجيل ${c.name}؟ سيُحذف التسجيل ويصبح الرقم متاحًا من جديد.`)) return;
    await api.rejectClient(c.id); toast('تم رفض التسجيل'); onChanged(); onClose();
  };
  const savePin = async () => {
    try {
      await api.resetPin(c.id, newPin);
      toast('تم تغيير الرمز السري'); setSentPin(newPin); setNewPin('');
    } catch (e) { toast((e as Error).message); }
  };
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await api.sendMessage({ clientId: c.id, title: title.trim(), body: body.trim() });
    setTitle(''); setBody(''); toast('تم إرسال الرسالة'); onClose();
  };
  return (
    <Sheet open onClose={onClose}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
        <span className="avatar" style={{ width: 52, height: 52, fontSize: 18 }}>{initials(c.name)}</span>
        <div>
          <h2 style={{ fontSize: 19 }}>{c.name}</h2>
          <div className="hint" dir="ltr" style={{ textAlign: 'right' }}>{c.phone}</div>
        </div>
      </div>
      {!c.approved && (
        <div className="card" style={{ background: 'var(--warn-bg)', boxShadow: 'none', marginBottom: 12 }}>
          <b style={{ color: 'var(--warn)' }}>تسجيل جديد بانتظار التأكيد</b>
          <p className="hint" style={{ color: 'var(--warn)', margin: '4px 0 10px' }}>تواصلي معها مرة واحدة (واتساب أو اتصال) للتأكد أن الرقم لها.</p>
          <div className="grid2">
            <button className="btn dark sm" onClick={approve}>{Icon.check} تأكيد</button>
            <button className="btn danger sm" onClick={reject}>رفض</button>
          </div>
        </div>
      )}
      <div className="grid2" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat"><b>{c.visits}</b><span>زيارات</span></div>
        <div className="stat"><b>{c.visits % T}/{T}</b><span>في الدورة الحالية</span></div>
        <div className="stat"><b>{Math.floor(c.visits / T)}</b><span>هدايا مستحقة</span></div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <a className="btn ghost" href={`tel:${c.phone}`}>{Icon.phone} اتصال</a>
        <a className="btn ghost" href={whatsappUrl('972' + c.phone.slice(1))} target="_blank" rel="noreferrer" style={{ color: '#1f9d55' }}>{Icon.whatsapp} واتساب</a>
      </div>
      <ClientAppointments appts={appts} onChanged={() => { reloadAppts(); onChanged(); }} />

      <div className="section-title">تاريخ الميلاد</div>
      <div className="row">
        <input className="input" type="date" value={birth} min={BIRTH_MIN} max={birthMax()} onChange={(e) => setBirth(e.target.value)} style={{ flex: 2 }} />
        <button className="btn soft" disabled={birth === (c.birthDate ?? '')} onClick={saveBirth}>حفظ</button>
      </div>
      {daysToBirthday(c.birthDate) === 0 && (
        <a className="btn primary block" style={{ marginTop: 10 }} href={whatsappUrl('972' + c.phone.slice(1), greeting)} target="_blank" rel="noreferrer">
          🎂 معايدة عبر واتساب
        </a>
      )}
      <div className="section-title">الرمز السري</div>
      <div className="row">
        <input className="input otp" style={{ flex: 2, fontSize: 18, letterSpacing: 8 }} inputMode="numeric" placeholder="4 أرقام جديدة"
          value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        <button className="btn soft" disabled={newPin.length !== 4} onClick={savePin}>تغيير</button>
      </div>
      {sentPin ? (
        <a className="btn primary block" style={{ marginTop: 8 }} target="_blank" rel="noreferrer"
          href={whatsappUrl('972' + c.phone.slice(1), `مرحبًا ${c.name.split(' ')[0]}، رمزك السري الجديد لتطبيق ${s.centerName} هو: ${sentPin}`)}>
          {Icon.whatsapp} أرسلي الرمز الجديد لها
        </a>
      ) : <p className="hint" style={{ marginTop: 6 }}>للزبونة التي نسيت رمزها. بعد التغيير تظهر إمكانية إرساله لها بواتساب.</p>}
      <form onSubmit={send} style={{ marginTop: 18 }}>
        <div className="section-title" style={{ marginTop: 0 }}>رسالة خاصة داخل التطبيق</div>
        <input className="input" placeholder="العنوان" value={title} onChange={(e) => setTitle(e.target.value)} style={{ marginBottom: 8 }} />
        <textarea className="input" placeholder="نص الرسالة" value={body} onChange={(e) => setBody(e.target.value)} />
        <button className="btn dark block" style={{ marginTop: 10 }} disabled={!title.trim()}>إرسال</button>
      </form>
    </Sheet>
  );
}

const STATUS: Record<ApptStatus, [string, string]> = {
  pending: ['بانتظار التأكيد', 'warn'],
  booked: ['محجوز', ''],
  completed: ['تمّ', 'ok'],
  cancelled: ['ملغى', 'red'],
  no_show: ['لم تحضر', 'warn'],
};

/** All of one client's appointments: upcoming first, then her history. */
function ClientAppointments({ appts, onChanged }: { appts: import('../../lib/types').AppointmentFull[] | null; onChanged: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const [showAllUp, setShowAllUp] = useState(false);
  const toast = useToast();
  if (!appts) return <div className="hint" style={{ padding: '12px 4px' }}>جارٍ تحميل المواعيد…</div>;
  const nowIso = new Date().toISOString();
  const upcoming = appts.filter((a) => (a.status === 'booked' || a.status === 'pending') && a.end > nowIso);
  const past = appts.filter((a) => !upcoming.includes(a)).reverse();
  const pastShown = showAll ? past : past.slice(0, 5);
  const row = (a: (typeof appts)[number], actions: boolean) => (
    <div className="item" key={a.id} style={{ padding: '10px 12px' }}>
      <div className="time-pill" style={{ minWidth: 58, fontSize: 14 }}>{fmtTime(a.start)}<small>{DAY_NAMES[new Date(a.start).getDay()]} {fmtShortDate(a.start)}</small></div>
      <div className="grow">
        <div className="t" style={{ fontSize: 14.5 }}>{a.treatment.name}</div>
        <div className="s">{a.treatment.durationMin} د{a.treatment.price ? ` · ₪${a.treatment.price}` : ''}{a.prepaid ? ' · مدفوع' : ''}</div>
      </div>
      {actions && a.status === 'booked' ? (
        <button className="btn soft sm" onClick={async () => { if (!confirm(`إلغاء موعد ${a.treatment.name}؟`)) return; await api.setAppointmentStatus(a.id, 'cancelled'); toast('تم إلغاء الموعد'); onChanged(); }}>إلغاء</button>
      ) : <span className={`tag ${STATUS[a.status][1]}`}>{STATUS[a.status][0]}</span>}
    </div>
  );
  return (
    <>
      <div className="section-title">مواعيدها القادمة <span className="hint">{upcoming.length}</span></div>
      {upcoming.length === 0 ? <div className="hint" style={{ padding: '0 4px' }}>لا توجد مواعيد قادمة</div>
        : <div className="list">{(showAllUp ? upcoming : upcoming.slice(0, 6)).map((a) => row(a, true))}</div>}
      {upcoming.length > 6 && <button className="btn sm" style={{ background: 'none', color: 'var(--coral-deep)', marginTop: 4 }} onClick={() => setShowAllUp(!showAllUp)}>{showAllUp ? 'عرض أقل' : `عرض كل المواعيد القادمة (${upcoming.length})`}</button>}
      {past.length > 0 && (
        <>
          <div className="section-title">زياراتها السابقة <span className="hint">{past.length}</span></div>
          <div className="list">{pastShown.map((a) => row(a, false))}</div>
          {past.length > 5 && <button className="btn sm" style={{ background: 'none', color: 'var(--coral-deep)', marginTop: 4 }} onClick={() => setShowAll(!showAll)}>{showAll ? 'عرض أقل' : `عرض الكل (${past.length})`}</button>}
        </>
      )}
    </>
  );
}
