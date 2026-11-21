import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Icon, Sheet, useLoad, useToast } from '../../components/ui';
import SlotPicker from '../../components/SlotPicker';
import { DAY_NAMES, addDays, fmtDate, fmtTime, normalizePhone, sameDay, startOfDay } from '../../lib/time';
import { whatsappUrl } from '../../lib/calendar';
import type { AppointmentFull, ApptStatus, Treatment } from '../../lib/types';
import { useAdmin } from './AdminApp';
import { isBirthdayToday, renderGreeting } from '../../lib/birthday';

const STATUS: Record<ApptStatus, [string, string]> = {
  pending: ['زبونة جديدة · بانتظار التأكيد', 'warn'],
  booked: ['محجوز', ''],
  completed: ['تمّ', 'ok'],
  cancelled: ['ملغى', 'red'],
  no_show: ['لم تحضر', 'warn'],
};

export default function Agenda() {
  const { settings: s } = useAdmin();
  const toast = useToast();
  const today = startOfDay(new Date());
  const dates = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(today, i - 3)), [today.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const [day, setDay] = useState(today);
  const [adding, setAdding] = useState(false);

  const { data, reload } = useLoad(async () => {
    const [appts, clients] = await Promise.all([
      api.listAppointments(day.toISOString(), addDays(day, 1).toISOString()),
      api.listClients(),
    ]);
    const visits = new Map(clients.map((c) => [c.id, c.visits]));
    const birthdays = clients.filter((c) => isBirthdayToday(c.birthDate));
    const pendingClients = clients.filter((c) => !c.approved).length;
    return { appts, visits, birthdays, pendingClients };
  }, [day.getTime()]);

  const active = data?.appts.filter((a) => a.status !== 'cancelled') ?? [];
  const done = active.filter((a) => a.status === 'completed').length;
  const prepaid = active.filter((a) => a.prepaid).length;

  const setStatus = async (a: AppointmentFull, st: ApptStatus) => {
    await api.setAppointmentStatus(a.id, st);
    toast(st === 'completed' ? `تم تسجيل زيارة ${a.client.name.split(' ')[0]}` : 'تم التحديث');
    reload();
  };

  const approve = async (a: AppointmentFull) => {
    await api.approveClient(a.clientId);
    toast(`تم تأكيد ${a.client.name.split(' ')[0]}، وتأكدت كل مواعيدها`);
    reload();
  };
  const reject = async (a: AppointmentFull) => {
    if (!confirm(`رفض تسجيل ${a.client.name}؟ سيُحذف التسجيل ومواعيده، ويصبح الرقم متاحًا من جديد.`)) return;
    await api.rejectClient(a.clientId);
    toast('تم رفض التسجيل');
    reload();
  };
  const confirmText = (a: AppointmentFull) =>
    `مرحبًا ${a.client.name.split(' ')[0]}، وصلنا طلب حجز في ${s.centerName} باسمك: ${a.treatment.name} يوم ${fmtDate(a.start)} الساعة ${fmtTime(a.start)}. هل نؤكد الموعد؟`;

  const reminderText = (a: AppointmentFull) =>
    `مرحبًا ${a.client.name.split(' ')[0]}، تذكير بموعدك في ${s.centerName}: ${a.treatment.name} يوم ${fmtDate(a.start)} الساعة ${fmtTime(a.start)}. نراكِ قريبًا!`;

  return (
    <>
      <header className="topbar">
        <div className="hello">لوحة الإدارة<b>{sameDay(day, today) ? 'مواعيد اليوم' : fmtDate(day.toISOString())}</b></div>
        <button className="btn primary sm" onClick={() => setAdding(true)}>{Icon.plus} موعد</button>
      </header>

      {data && data.pendingClients > 0 && (
        <Link to="/admin/clients?f=pending" className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', background: 'var(--warn-bg)', boxShadow: 'none', marginBottom: 12 }}>
          <span className="avatar" style={{ background: '#fff', color: 'var(--warn)' }}>{data.pendingClients}</span>
          <span style={{ flex: 1, color: 'var(--warn)', fontWeight: 600 }}>
            {data.pendingClients === 1 ? 'زبونة جديدة بانتظار التأكيد' : 'زبائن جدد بانتظار التأكيد'}
          </span>
          <span style={{ width: 20, color: 'var(--warn)', transform: 'scaleX(-1)' }}>{Icon.back}</span>
        </Link>
      )}

      <div className="chips">
        {dates.map((d) => (
          <button key={d.toISOString()} className={`day${sameDay(d, day) ? ' on' : ''}`} onClick={() => setDay(d)}>
            <small>{sameDay(d, today) ? 'اليوم' : DAY_NAMES[d.getDay()]}</small>
            <b>{d.getDate()}</b>
          </button>
        ))}
      </div>

      <div className="grid2" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 6 }}>
        <div className="stat"><b>{active.length}</b><span>مواعيد</span></div>
        <div className="stat"><b>{done}</b><span>تمّت</span></div>
        <div className="stat"><b>{prepaid}</b><span>مدفوعة مسبقًا</span></div>
      </div>

      {sameDay(day, today) && data && data.birthdays.length > 0 && (
        <div className="card bday" style={{ marginTop: 12 }}>
          <b>🎂 عيد ميلاد اليوم</b>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {data.birthdays.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, fontWeight: 600 }}>{c.name}</span>
                <a className="btn light sm" href={whatsappUrl('972' + c.phone.slice(1), `${renderGreeting(s.birthdayTitle, c.name, s.birthdayGift)}\n${renderGreeting(s.birthdayBody, c.name, s.birthdayGift)}`)} target="_blank" rel="noreferrer">
                  {Icon.whatsapp} معايدة
                </a>
              </div>
            ))}
          </div>
          {s.birthdayEnabled && <p className="hint" style={{ marginTop: 8, fontSize: 12 }}>المعايدة داخل التطبيق تُرسل تلقائيًا كل صباح</p>}
        </div>
      )}

      <div className="section-title">الجدول</div>
      {!data ? <div className="hint">جارٍ التحميل…</div> : data.appts.length === 0 ? (
        <div className="card empty">لا توجد مواعيد في هذا اليوم</div>
      ) : data.appts.map((a) => {
        const v = data.visits.get(a.clientId) ?? 0;
        const giftNow = a.status === 'booked' && v % s.loyaltyTarget === s.loyaltyTarget - 1;
        return (
          <div className="card" key={a.id} style={{ opacity: a.status === 'cancelled' ? 0.55 : 1 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div className="time-pill">{fmtTime(a.start)}<small>{a.treatment.durationMin} د</small></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link to={`/admin/clients?c=${a.clientId}`} style={{ fontWeight: 700, display: 'block', textDecoration: 'none' }}>{a.client.name}</Link>
                <div className="hint">{a.treatment.name}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  <span className={`tag ${STATUS[a.status][1]}`}>{STATUS[a.status][0]}</span>
                  {a.prepaid && <span className="tag ok">مدفوع</span>}
                  {giftNow && <span className="tag gift">{s.loyaltyTarget === 10 ? 'الزيارة العاشرة: هدية' : 'زيارة هدية'}</span>}
                  <span className="tag">{v} زيارات</span>
                </div>
              </div>
            </div>
            {a.status === 'pending' && (
              <>
                <p className="hint" style={{ marginTop: 10 }}>تسجيل جديد: تواصلي معها مرة واحدة للتأكد أن الرقم لها، ثم أكّديها.</p>
                <div className="grid2" style={{ marginTop: 8 }}>
                  <a className="btn ghost sm" href={whatsappUrl('972' + a.client.phone.slice(1), confirmText(a))} target="_blank" rel="noreferrer" style={{ color: '#1f9d55' }}>{Icon.whatsapp} واتساب</a>
                  <a className="btn ghost sm" href={`tel:${a.client.phone}`}>{Icon.phone} اتصال</a>
                </div>
                <div className="grid2" style={{ marginTop: 8 }}>
                  <button className="btn dark sm" onClick={() => approve(a)}>{Icon.check} تأكيد الزبونة</button>
                  <button className="btn danger sm" onClick={() => reject(a)}>رفض</button>
                </div>
              </>
            )}
            {a.status === 'booked' && (
              <>
                <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 12 }}>
                  <button className="btn dark sm" onClick={() => setStatus(a, 'completed')}>{Icon.check} تمّ</button>
                  <button className="btn soft sm" onClick={() => setStatus(a, 'no_show')}>لم تحضر</button>
                  <button className="btn danger sm" onClick={() => { if (confirm('إلغاء الموعد؟')) setStatus(a, 'cancelled'); }}>إلغاء</button>
                </div>
                <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 8 }}>
                  <a className="btn ghost sm" href={`tel:${a.client.phone}`}>{Icon.phone}</a>
                  <a className="btn ghost sm" href={whatsappUrl('972' + a.client.phone.slice(1), reminderText(a))} target="_blank" rel="noreferrer" style={{ color: '#1f9d55' }}>{Icon.whatsapp} تذكير</a>
                  <button className="btn ghost sm" onClick={async () => { await api.setPrepaid(a.id, !a.prepaid); reload(); }}>{a.prepaid ? 'إلغاء الدفع' : 'سُجّل دفع'}</button>
                </div>
              </>
            )}
            {(a.status === 'completed' || a.status === 'no_show') && (
              <button className="btn soft sm" style={{ marginTop: 10 }} onClick={() => setStatus(a, 'booked')}>تراجع</button>
            )}
          </div>
        );
      })}

      <AddAppointment open={adding} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); toast('تمت إضافة الموعد'); }} />
    </>
  );
}

function AddAppointment({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { settings } = useAdmin();
  const { data: treatments } = useLoad(() => api.listTreatments(), [open]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tid, setTid] = useState('');
  const [slot, setSlot] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const t: Treatment | undefined = treatments?.find((x) => x.id === tid);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    const p = normalizePhone(phone);
    if (!name.trim() || !p) return setErr('الاسم ورقم الهاتف مطلوبان');
    if (!t || !slot) return setErr('اختاري العلاج والوقت');
    try { await api.adminBook(name.trim(), p, t.id, slot); setName(''); setPhone(''); setSlot(null); onDone(); }
    catch (e) { setErr((e as Error).message); }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <form onSubmit={submit}>
        <h2 style={{ fontSize: 19, marginBottom: 14 }}>موعد جديد</h2>
        <div className="grid2">
          <label className="field"><span>الاسم</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field"><span>الهاتف</span><input className="input ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        </div>
        <label className="field"><span>العلاج</span>
          <select className="input" value={tid} onChange={(e) => { setTid(e.target.value); setSlot(null); }}>
            <option value="">اختاري…</option>
            {treatments?.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.durationMin} د)</option>)}
          </select>
        </label>
        {t && <SlotPicker treatment={t} settings={settings} value={slot} onChange={setSlot} days={30} />}
        {err && <p className="error" style={{ marginTop: 12 }}>{err}</p>}
        <button className="btn primary block" style={{ marginTop: 16 }}>حفظ الموعد</button>
      </form>
    </Sheet>
  );
}

