import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Icon, LoyaltyCard, useLoad, useToast } from '../../components/ui';
import { fmtShortDate, fmtTime, DAY_NAMES } from '../../lib/time';
import type { AppointmentFull, ApptStatus } from '../../lib/types';
import { useClient } from './ClientApp';
import { CalendarButtons, PrepayButton } from './parts';

const STATUS: Record<ApptStatus, [string, string]> = {
  pending: ['بانتظار التأكيد', 'warn'],
  booked: ['محجوز', ''],
  completed: ['تمّ', 'ok'],
  cancelled: ['ملغى', 'red'],
  no_show: ['لم تحضري', 'warn'],
};

export default function Appointments() {
  const { settings: s, signOut } = useClient();
  const toast = useToast();
  const { data, reload } = useLoad(() => api.myAppointments());
  const nowIso = new Date().toISOString();
  const upcoming = data?.filter((a) => (a.status === 'booked' || a.status === 'pending') && a.end > nowIso) ?? [];
  const past = (data?.filter((a) => !upcoming.includes(a)) ?? []).reverse();
  const visits = data?.filter((a) => a.status === 'completed').length ?? 0;

  const cancel = async (a: AppointmentFull) => {
    if (!confirm(`إلغاء موعد ${a.treatment.name}؟`)) return;
    await api.cancelAppointment(a.id);
    toast('تم إلغاء الموعد');
    reload();
  };

  return (
    <>
      <h1 className="page-title">زياراتي</h1>
      {data && s.loyaltyEnabled && <LoyaltyCard visits={visits} target={s.loyaltyTarget} reward={s.loyaltyReward} />}
      <div className="section-title">المواعيد القادمة</div>
      {!data ? <div className="hint">جارٍ التحميل…</div> : upcoming.length === 0 ? (
        <div className="card empty">
          <p style={{ marginBottom: 12 }}>لا توجد مواعيد قادمة</p>
          <Link to="/book" className="btn primary">احجزي موعدًا</Link>
        </div>
      ) : upcoming.map((a) => (
        <div className="card" key={a.id} style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="time-pill">{fmtTime(a.start)}<small>{DAY_NAMES[new Date(a.start).getDay()]} {fmtShortDate(a.start)}</small></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{a.treatment.name}</div>
              <div className="hint">{a.treatment.durationMin} دقيقة</div>
              {a.status === 'pending' && <span className="tag warn" style={{ marginTop: 4 }}>بانتظار تأكيد المركز</span>}
            </div>
          </div>
          <CalendarButtons a={a} s={s} />
          <PrepayButton a={a} s={s} />
          <button className="btn danger sm" onClick={() => cancel(a)}>إلغاء الموعد</button>
        </div>
      ))}

      {past.length > 0 && (
        <>
          <div className="section-title">الزيارات السابقة</div>
          <div className="list">
            {past.map((a) => (
              <div className="item" key={a.id}>
                <div className="grow">
                  <div className="t">{a.treatment.name}</div>
                  <div className="s">{fmtShortDate(a.start)} · {fmtTime(a.start)}</div>
                </div>
                <span className={`tag ${STATUS[a.status][1]}`}>{STATUS[a.status][0]}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <button className="btn ghost block" style={{ marginTop: 24 }} onClick={() => { if (confirm('تسجيل الخروج من هذا الجهاز؟')) signOut(); }}>
        {Icon.logout} تسجيل الخروج
      </button>
    </>
  );
}
