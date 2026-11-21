import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { CountdownView, Icon, LoyaltyCard, useLoad } from '../../components/ui';
import { fmtDate, fmtShortDate, fmtTime } from '../../lib/time';
import { useClient } from './ClientApp';
import { CalendarButtons, ContactRow, InstallBanner, PrepayButton, RemindersCard, whatsappApptText } from './parts';
import { readIds } from '../../lib/pwa';

export default function Home() {
  const { client, settings: s, signOut } = useClient();
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

  return (
    <>
      <header className="topbar">
        <div className="hello">{greet}<b>{firstName}</b></div>
        <button className="btn sm" style={{ background: 'none', padding: 0 }} onClick={() => { if (confirm('تسجيل الخروج من هذا الجهاز؟')) signOut(); }} aria-label="خروج">
          <img src="/mark.svg" alt="DermaCare" style={{ height: 40 }} />
        </button>
      </header>

      {!data ? (
        <div className="card hero" style={{ height: 210 }} />
      ) : next ? (
        <div className="card hero">
          <div className="label">موعدك القادم</div>
          <h2>{next.treatment.name}</h2>
          <div className="when">{fmtDate(next.start)} · الساعة {fmtTime(next.start)}</div>
          <CountdownView target={next.start} />
          <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 8 }}>
            <CalendarButtons a={next} s={s} dark />
            <PrepayButton a={next} s={s} />
          </div>
        </div>
      ) : (
        <div className="card hero">
          <div className="label">لا يوجد موعد قادم</div>
          <h2 style={{ marginBottom: 16 }}>وقت تدلّلي بشرتك؟</h2>
          <Link to="/book" className="btn primary block" style={{ position: 'relative', zIndex: 1 }}>{Icon.plus} احجزي موعدًا</Link>
        </div>
      )}

      <div style={{ marginTop: 12 }}><RemindersCard /></div>

      {data && s.loyaltyEnabled && (
        <>
          <div className="section-title">الولاء</div>
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
    </>
  );
}
