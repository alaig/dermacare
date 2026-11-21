import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { CountdownView, Icon, LoyaltyCard, Sheet, useLoad, useToast } from '../../components/ui';
import AnimatedLogo from '../../components/AnimatedLogo';
import { fmtDate, fmtShortDate, fmtTime } from '../../lib/time';
import { BIRTH_MIN, birthMax, isBirthdayToday } from '../../lib/birthday';
import { useClient } from './ClientApp';
import { CalendarButtons, ContactRow, InstallBanner, PrepayButton, RemindersCard, whatsappApptText } from './parts';
import { readIds } from '../../lib/pwa';

/** Play the full logo animation once per app session; afterwards show it static. */
function introOnce() {
  try {
    if (sessionStorage.getItem('dc-intro') === '1') return false;
    sessionStorage.setItem('dc-intro', '1');
  } catch { /* ignore */ }
  return true;
}

export default function Home() {
  const { client, settings: s } = useClient();
  const navigate = useNavigate();
  const [animate] = useState(introOnce);
  const { data } = useLoad(async () => {
    const [appts, visits, msgs] = await Promise.all([api.myAppointments(), api.myVisits(), api.myMessages()]);
    return { appts, visits, msgs };
  });
  const nowIso = new Date().toISOString();
  const next = data?.appts.find((a) => a.status === 'booked' && a.end > nowIso);
  const firstName = client.name.split(' ')[0];
  const r = readIds();
  const latest = data?.msgs[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'صباح الخير' : 'مساء الخير';
  const d = (sec: number) => ({ '--d': `${animate ? sec : 0}s` } as React.CSSProperties);
  const birthday = isBirthdayToday(client.birthDate);

  return (
    <>
      <section className="intro">
        <AnimatedLogo animate={animate} />
        <p className="greet rise" style={d(1.9)}>{greet}، <b>{firstName}</b></p>
        <div className="intro-actions">
          <button className="btn primary rise" style={d(2.05)} onClick={() => navigate('/book')}>{Icon.plus} حجز موعد جديد</button>
          <button className="btn dark rise" style={d(2.2)} onClick={() => navigate('/appointments')}>{Icon.calendar} زياراتي</button>
        </div>
      </section>

      <div className="rise" style={{ ...d(2.35), marginTop: 18 }}>
        {birthday && s.birthdayEnabled && (
          <div className="card bday" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 30, lineHeight: 1 }}>🎂</div>
            <h2 style={{ fontSize: 20, margin: '8px 0 4px' }}>عيد ميلاد سعيد يا {firstName}!</h2>
            <p className="hint" style={{ fontSize: 15 }}>هديتك منّا اليوم: <b style={{ color: '#fff' }}>{s.birthdayGift}</b></p>
          </div>
        )}
        {!client.birthDate && <BirthdayPrompt />}

        {next && (
          <div className="card hero" style={{ marginBottom: 12 }}>
            <div className="label">موعدك القادم</div>
            <h2>{next.treatment.name}</h2>
            <div className="when">{fmtDate(next.start)} · الساعة {fmtTime(next.start)}</div>
            <CountdownView target={next.start} />
            <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 8 }}>
              <CalendarButtons a={next} s={s} dark />
              <PrepayButton a={next} s={s} />
            </div>
          </div>
        )}

        {next && <RemindersCard />}

        {data && s.loyaltyEnabled && (
          <>
            <div className="section-title">بطاقة الزيارات</div>
            <LoyaltyCard visits={data.visits} target={s.loyaltyTarget} reward={s.loyaltyReward} />
          </>
        )}

        {latest && (
          <>
            <div className="section-title">
              آخر رسالة من المركز
              <Link to="/messages" style={{ color: 'var(--coral-deep)', fontSize: 13, textDecoration: 'none' }}>الكل</Link>
            </div>
            <Link to="/messages" className={`card msg${r.has(latest.id) ? '' : ' unread'}`} style={{ display: 'block', textDecoration: 'none' }}>
              <div className="meta">{fmtShortDate(latest.createdAt)}</div>
              <h3>{latest.title}</h3>
              <p style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{latest.body}</p>
            </Link>
          </>
        )}

        <div className="section-title">تواصلي معنا</div>
        <ContactRow s={s} text={next ? whatsappApptText(next) : ''} />

        <div style={{ marginTop: 12 }}><InstallBanner /></div>
      </div>
    </>
  );
}

function BirthdayPrompt() {
  const { client, setClient } = useClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState('');
  const save = async () => {
    if (!val || val < BIRTH_MIN || val > birthMax()) return toast('اختاري تاريخًا صحيحًا');
    await api.setMyBirthDate(val);
    setClient({ ...client, birthDate: val });
    setOpen(false);
    toast('تم الحفظ، انتظري مفاجأة في عيد ميلادك 🎁');
  };
  return (
    <>
      <button className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%', border: 0, textAlign: 'start', cursor: 'pointer', marginBottom: 12 }} onClick={() => setOpen(true)}>
        <span className="avatar" style={{ fontSize: 20 }}>🎁</span>
        <span style={{ flex: 1 }}>
          <b style={{ display: 'block' }}>هدية في عيد ميلادك</b>
          <span className="hint">أضيفي تاريخ ميلادك، والباقي علينا</span>
        </span>
        <span className="btn dark sm">إضافة</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <h2 style={{ fontSize: 19, marginBottom: 14 }}>تاريخ ميلادك</h2>
        <input className="input" type="date" value={val} min={BIRTH_MIN} max={birthMax()} onChange={(e) => setVal(e.target.value)} />
        <button className="btn primary block" style={{ marginTop: 14 }} onClick={save}>حفظ</button>
      </Sheet>
    </>
  );
}
