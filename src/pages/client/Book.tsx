import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Icon, useLoad } from '../../components/ui';
import SlotPicker from '../../components/SlotPicker';
import { fmtDate, fmtTime } from '../../lib/time';
import type { AppointmentFull, Treatment } from '../../lib/types';
import { useClient } from './ClientApp';
import { CalendarButtons, PrepayButton, RemindersCard } from './parts';

export default function Book() {
  const { client, settings: s } = useClient();
  const { data: treatments } = useLoad(() => api.listTreatments());
  const [t, setT] = useState<Treatment | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<AppointmentFull | null>(null);

  const confirm = async () => {
    if (!t || !slot) return;
    setBusy(true); setErr('');
    try {
      const a = await api.book(t.id, slot);
      setDone({ ...a, client, treatment: t });
    } catch (e) { setErr((e as Error).message); setSlot(null); }
    finally { setBusy(false); }
  };

  if (done) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 20 }}>
        <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'var(--coral)', color: '#fff', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
          <span style={{ width: 40, display: 'block' }}>{Icon.check}</span>
        </div>
        <h1 className="page-title" style={{ marginBottom: 4 }}>تم الحجز!</h1>
        <p className="hint" style={{ fontSize: 15 }}>{done.treatment.name}</p>
        <p style={{ fontWeight: 700, fontSize: 17, margin: '4px 0 20px' }}>{fmtDate(done.start)} · {fmtTime(done.start)}</p>
        <div className="card" style={{ textAlign: 'start', display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 600 }}>أضيفي الموعد لتقويمك</div>
          <CalendarButtons a={done} s={s} />
          <PrepayButton a={done} s={s} />
        </div>
        <div style={{ marginTop: 12, textAlign: 'start' }}><RemindersCard /></div>
        <Link to="/" className="btn ghost block" style={{ marginTop: 16 }}>إلى الرئيسية</Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="page-title">{t ? 'اختاري الموعد' : 'ماذا تحجزين؟'}</h1>
      {!t ? (
        !treatments ? <div className="hint">جارٍ التحميل…</div> : treatments.map((x) => (
          <button key={x.id} className="treat" onClick={() => setT(x)}>
            <span className="ico"><img src="/mark.svg" alt="" /></span>
            <span style={{ flex: 1 }}>
              <b style={{ display: 'block' }}>{x.name}</b>
              <span className="hint">{x.durationMin} دقيقة{x.price ? ` · ₪${x.price}` : x.price === 0 ? ' · مجانًا' : ''}</span>
            </span>
            <span style={{ width: 20, color: 'var(--rose)', transform: 'scaleX(-1)' }}>{Icon.back}</span>
          </button>
        ))
      ) : (
        <>
          <button className="treat on" onClick={() => { setT(null); setSlot(null); }}>
            <span className="ico"><img src="/mark.svg" alt="" /></span>
            <span style={{ flex: 1 }}>
              <b style={{ display: 'block' }}>{t.name}</b>
              <span className="hint">{t.durationMin} دقيقة · اضغطي للتغيير</span>
            </span>
          </button>
          <SlotPicker treatment={t} settings={s} value={slot} onChange={setSlot} />
          {err && <p className="error" style={{ marginTop: 12 }}>{err}</p>}
          <div style={{ position: 'sticky', bottom: 'calc(var(--safe-b) + 92px)', marginTop: 18 }}>
            <button className="btn primary block" disabled={!slot || busy} onClick={confirm} style={{ boxShadow: 'var(--shadow)' }}>
              {busy ? 'لحظة…' : slot ? `تأكيد الحجز · ${fmtTime(slot)}` : 'اختاري وقتًا'}
            </button>
          </div>
        </>
      )}
    </>
  );
}
