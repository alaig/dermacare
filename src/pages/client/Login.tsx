import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { normalizePhone } from '../../lib/time';
import { BIRTH_MIN, birthMax } from '../../lib/birthday';
import type { Client } from '../../lib/types';
import { Icon } from '../../components/ui';

export default function Login({ onDone, onBack }: { onDone: (c: Client) => void; onBack?: () => void }) {
  const [step, setStep] = useState<'details' | 'code'>('details');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birth, setBirth] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (name.trim().length < 2) return setErr('اكتبي الاسم الكامل');
    const p = normalizePhone(phone);
    if (!p) return setErr('رقم الهاتف غير صحيح (مثال: 0501234567)');
    if (!birth) return setErr('اختاري تاريخ ميلادك');
    if (birth < BIRTH_MIN || birth > birthMax()) return setErr('تاريخ الميلاد غير صحيح');
    setBusy(true);
    try { await api.requestOtp(p); setPhone(p); setStep('code'); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try { onDone(await api.verifyOtp(phone, code.trim(), name.trim(), birth || null)); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="app" style={{ paddingBottom: 24 }}>
      {onBack && step === 'details' && (
        <button className="btn sm" style={{ background: 'none', padding: 0, minHeight: 32, color: 'var(--muted)' }} onClick={onBack}>
          <span style={{ width: 18, display: 'block' }}>{Icon.back}</span> رجوع
        </button>
      )}
      <div className="welcome" style={{ minHeight: 'calc(100dvh - 160px)' }}>
        <img src="/logo.svg" alt="DermaCare" className="logo-big" style={{ width: 170 }} />
        {step === 'details' ? (
          <form onSubmit={send} className="card rise" style={{ padding: 20 }}>
            <h1 style={{ fontSize: 21, marginBottom: 4 }}>أهلًا بك</h1>
            <p className="hint" style={{ marginBottom: 18 }}>سجّلي مرة واحدة فقط، وبعدها تحجزين بلمسة.</p>
            <label className="field">
              <span>الاسم الكامل</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="مثال: رنا خوري" />
            </label>
            <label className="field">
              <span>رقم الهاتف</span>
              <input className="input ltr" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="05X-XXXXXXX" />
            </label>
            <label className="field">
              <span>تاريخ الميلاد 🎁 <span style={{ fontWeight: 400 }}>· لتصلك هدية في عيد ميلادك</span></span>
              <input className="input" type="date" value={birth} min={BIRTH_MIN} max={birthMax()} onChange={(e) => setBirth(e.target.value)} autoComplete="bday" />
            </label>
            {err && <p className="error">{err}</p>}
            <button className="btn primary block" disabled={busy}>{busy ? 'لحظة…' : 'أرسلي لي رمز التحقق'}</button>
            <p className="hint" style={{ marginTop: 12, textAlign: 'center' }}>نستخدم بياناتك لتأكيد مواعيدك وتذكيرك بها فقط.</p>
          </form>
        ) : (
          <form onSubmit={verify} className="card rise" style={{ padding: 20 }}>
            <h1 style={{ fontSize: 21, marginBottom: 4 }}>رمز التحقق</h1>
            <p className="hint" style={{ marginBottom: 18 }}>أرسلنا رسالة SMS إلى <span dir="ltr">{phone}</span></p>
            <input className="input otp" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="••••••" />
            {api.mode === 'demo' && <p className="hint" style={{ margin: '8px 0' }}>نسخة تجريبية: الرمز هو 1234</p>}
            {err && <p className="error" style={{ marginTop: 8 }}>{err}</p>}
            <button className="btn primary block" disabled={busy || code.length < 4} style={{ marginTop: 14 }}>{busy ? 'لحظة…' : 'دخول'}</button>
            <button type="button" className="btn ghost block" style={{ marginTop: 8 }} onClick={() => { setStep('details'); setCode(''); setErr(''); }}>تغيير الرقم</button>
          </form>
        )}
      </div>
    </div>
  );
}
