import { useState } from 'react';
import { api } from '../../lib/api';
import { Icon, Sheet, Switch, useLoad, useToast } from '../../components/ui';
import { DAY_NAMES } from '../../lib/time';
import type { Settings, Treatment } from '../../lib/types';
import { useAdmin } from './AdminApp';
import { resetDemo } from '../../lib/demo';

export default function AdminSettings() {
  const { settings, setSettings, signOut } = useAdmin();
  const toast = useToast();
  const [s, set] = useState<Settings>(settings);
  const { data: treatments, reload } = useLoad(() => api.listTreatments(true));
  const [editT, setEditT] = useState<Treatment | null>(null);
  const up = <K extends keyof Settings>(k: K, v: Settings[K]) => set((p) => ({ ...p, [k]: v }));
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);

  const save = async () => {
    await api.saveSettings(s);
    setSettings(s);
    toast('تم حفظ الإعدادات');
  };

  const feed = api.calendarFeedUrl(s.calendarToken);

  return (
    <>
      <h1 className="page-title">الإعدادات</h1>

      <div className="section-title" style={{ marginTop: 0 }}>بطاقة الزيارات (الولاء)</div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>إظهار البطاقة للزبائن</div>
            <div className="hint">عند الإيقاف تبقى المتابعة متاحة لك في قائمة الزبائن</div>
          </div>
          <Switch checked={s.loyaltyEnabled} onChange={(v) => up('loyaltyEnabled', v)} label="إظهار بطاقة الزيارات" />
        </div>
        <div className="grid2">
          <label className="field"><span>الزيارة الهدية رقم</span>
            <input className="input" type="number" min={2} max={30} value={s.loyaltyTarget} onChange={(e) => up('loyaltyTarget', Math.max(2, Number(e.target.value) || 10))} />
          </label>
          <label className="field"><span>نص الهدية</span>
            <input className="input" value={s.loyaltyReward} onChange={(e) => up('loyaltyReward', e.target.value)} />
          </label>
        </div>
      </div>

      <div className="section-title">بيانات المركز</div>
      <div className="card">
        <label className="field"><span>رقم الهاتف</span><input className="input ltr" value={s.phone} onChange={(e) => up('phone', e.target.value)} /></label>
        <label className="field"><span>واتساب (بصيغة دولية، مثال 972501234567)</span><input className="input ltr" value={s.whatsapp} onChange={(e) => up('whatsapp', e.target.value.replace(/\D/g, ''))} /></label>
        <label className="field"><span>العنوان</span><input className="input" value={s.address} onChange={(e) => up('address', e.target.value)} /></label>
        <label className="field" style={{ marginBottom: 0 }}><span>رابط الدفع المسبق (بيت / شركة السليقة) — اتركيه فارغًا لإخفاء الزر</span><input className="input ltr" value={s.prepayUrl} onChange={(e) => up('prepayUrl', e.target.value)} /></label>
      </div>

      <div className="section-title">ساعات العمل</div>
      <div className="card">
        {s.workHours.map((h, i) => (
          <div className="hours-row" key={i}>
            <b style={{ fontSize: 14 }}>{DAY_NAMES[i]}</b>
            <input className="input ltr" type="time" value={h?.open ?? ''} disabled={!h} onChange={(e) => up('workHours', s.workHours.map((x, j) => (j === i && x ? { ...x, open: e.target.value } : x)))} />
            <input className="input ltr" type="time" value={h?.close ?? ''} disabled={!h} onChange={(e) => up('workHours', s.workHours.map((x, j) => (j === i && x ? { ...x, close: e.target.value } : x)))} />
            <Switch checked={!!h} label={`${DAY_NAMES[i]} يوم عمل`} onChange={(v) => up('workHours', s.workHours.map((x, j) => (j === i ? (v ? { open: '09:00', close: '18:00' } : null) : x)))} />
          </div>
        ))}
        <label className="field" style={{ marginTop: 8, marginBottom: 0 }}><span>فاصل المواعيد (دقائق)</span>
          <select className="input" value={s.slotMinutes} onChange={(e) => up('slotMinutes', Number(e.target.value))}>
            {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>

      {dirty && (
        <div style={{ position: 'sticky', bottom: 'calc(var(--safe-b) + 92px)', marginTop: 14, zIndex: 5 }}>
          <button className="btn primary block" onClick={save} style={{ boxShadow: 'var(--shadow)' }}>حفظ التغييرات</button>
        </div>
      )}

      <div className="section-title">
        العلاجات
        <button className="btn soft sm" onClick={() => setEditT({ id: '', name: '', durationMin: 30, price: null, active: true })}>{Icon.plus} إضافة</button>
      </div>
      <div className="list">
        {treatments?.map((t) => (
          <button key={t.id} className="item" style={{ width: '100%', border: 0, background: 'none', textAlign: 'start', cursor: 'pointer', opacity: t.active ? 1 : 0.5 }} onClick={() => setEditT(t)}>
            <span className="grow"><span className="t" style={{ display: 'block' }}>{t.name}</span><span className="s">{t.durationMin} دقيقة{t.price != null ? ` · ₪${t.price}` : ''}</span></span>
            {!t.active && <span className="tag">مخفي</span>}
          </button>
        ))}
      </div>

      <div className="section-title">التقويم</div>
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 4 }}>كل المواعيد في تقويمك تلقائيًا</div>
        <p className="hint" style={{ marginBottom: 10 }}>أضيفي هذا الرابط مرة واحدة: في Google Calendar من «إضافة تقويم ← من عنوان URL»، وفي iPhone من «الإعدادات ← التقويم ← الحسابات ← إضافة اشتراك تقويم».</p>
        {feed ? (
          <>
            <div className="copy">{feed}</div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn soft sm" onClick={() => { navigator.clipboard?.writeText(feed.replace(/^webcal:/, 'https:')); toast('تم نسخ الرابط'); }}>نسخ الرابط</button>
              <a className="btn soft sm" href={feed}>{Icon.apple} فتح في Apple</a>
            </div>
          </>
        ) : <p className="hint">يعمل بعد ربط قاعدة البيانات (غير متاح في النسخة التجريبية).</p>}
      </div>

      <div className="section-title">الحساب</div>
      <div className="card" style={{ display: 'grid', gap: 8 }}>
        <a className="btn ghost" href="/">عرض التطبيق كزبونة</a>
        {api.mode === 'demo' && <button className="btn ghost" onClick={() => { if (confirm('إعادة البيانات التجريبية؟')) { resetDemo(); location.reload(); } }}>إعادة البيانات التجريبية</button>}
        <button className="btn danger" onClick={signOut}>{Icon.logout} تسجيل الخروج</button>
      </div>

      <TreatmentSheet t={editT} onClose={() => setEditT(null)} onSaved={() => { setEditT(null); reload(); toast('تم الحفظ'); }} />
    </>
  );
}

function TreatmentSheet({ t, onClose, onSaved }: { t: Treatment | null; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState<Treatment | null>(t);
  const [last, setLast] = useState(t);
  if (t !== last) { setLast(t); setV(t); }
  if (!t || !v) return null;
  return (
    <Sheet open onClose={onClose}>
      <h2 style={{ fontSize: 19, marginBottom: 14 }}>{t.id ? 'تعديل علاج' : 'علاج جديد'}</h2>
      <label className="field"><span>الاسم</span><input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
      <div className="grid2">
        <label className="field"><span>المدة (دقائق)</span><input className="input" type="number" min={5} step={5} value={v.durationMin} onChange={(e) => setV({ ...v, durationMin: Number(e.target.value) || 30 })} /></label>
        <label className="field"><span>السعر ₪ (اختياري)</span><input className="input" type="number" min={0} value={v.price ?? ''} onChange={(e) => setV({ ...v, price: e.target.value === '' ? null : Number(e.target.value) })} /></label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ flex: 1, fontWeight: 600 }}>ظاهر للحجز</span>
        <Switch checked={v.active} onChange={(a) => setV({ ...v, active: a })} label="ظاهر للحجز" />
      </div>
      <button className="btn primary block" disabled={!v.name.trim()} onClick={async () => { await api.saveTreatment(v); onSaved(); }}>حفظ</button>
    </Sheet>
  );
}
