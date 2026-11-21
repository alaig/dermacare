import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { normalizePhone } from '../../lib/time';
import type { Client } from '../../lib/types';

export default function Login({ onDone }: { onDone: (c: Client) => void }) {
  const [step, setStep] = useState<'details' | 'code'>('details');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (name.trim().length < 2) return setErr('اكتبي الاسم الكامل');
    const p = normalizePhone(phone);
    if (!p) return setErr('رقم الهاتف غير صحيح (مثال: 0501234567)');
    setBusy(true);
    try { await api.requestOtp(p); setPhone(p); setStep('code'); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try { onDone(await api.verifyOtp(phone, code.trim(), name.trim())); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="app" style={{ paddingBottom: 24 }}>
      <div className="welcome">
        <img src="/logo.svg" alt="DermaCare" className="logo-big" />
        {step === 'details' ? (
          <form onSubmit={send} className="card" style={{ padding: 20 }}>
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
            {err && <p className="error">{err}</p>}
            <button className="btn primary block" disabled={busy}>{busy ? 'لحظة…' : 'أرسلي لي رمز التحقق'}</button>
            <p className="hint" style={{ marginTop: 12, textAlign: 'center' }}>نستخدم رقمك لتأكيد مواعيدك وتذكيرك بها فقط.</p>
          </form>
        ) : (
          <form onSubmit={verify} className="card" style={{ padding: 20 }}>
            <h1 style={{ fontSize: 21, marginBottom: 4 }}>رمز التحقق</h1>
            <p className="hint" style={{ marginBottom: 18 }}>أرسلنا رسالة SMS إلى <span dir="ltr">{phone}</span></p>
            <input className="input otp" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="••••" />
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
