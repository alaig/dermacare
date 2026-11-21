import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { normalizePhone } from '../../lib/time';
import { BIRTH_MIN, birthMax } from '../../lib/birthday';
import { whatsappUrl } from '../../lib/calendar';
import type { Client, Settings } from '../../lib/types';
import { Icon } from '../../components/ui';

const pinOk = (p: string) => /^\d{4}$/.test(p);
const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, 4);

export default function Login({ onDone, onBack, settings }: { onDone: (c: Client) => void; onBack?: () => void; settings: Settings }) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birth, setBirth] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [err, setErr] = useState('');
  const [taken, setTaken] = useState(false);
  const [busy, setBusy] = useState(false);

  const switchMode = (m: 'register' | 'login') => { setMode(m); setErr(''); setTaken(false); setPin(''); setPin2(''); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(''); setTaken(false);
    const p = normalizePhone(phone);
    if (mode === 'register') {
      if (name.trim().length < 2) return setErr('اكتبي الاسم الكامل');
      if (!p) return setErr('رقم الهاتف غير صحيح (مثال: 0501234567)');
      if (!birth) return setErr('اختاري تاريخ ميلادك');
      if (birth < BIRTH_MIN || birth > birthMax()) return setErr('تاريخ الميلاد غير صحيح');
      if (!pinOk(pin)) return setErr('الرمز السري يجب أن يكون 4 أرقام');
      if (pin !== pin2) return setErr('الرمزان غير متطابقين');
    } else {
      if (!p) return setErr('رقم الهاتف غير صحيح (مثال: 0501234567)');
      if (!pinOk(pin)) return setErr('اكتبي الرمز السري (4 أرقام)');
    }
    setBusy(true);
    try {
      const c = mode === 'register'
        ? await api.registerClient(name.trim(), p!, birth, pin)
        : await api.loginClient(p!, pin);
      onDone(c);
    } catch (e) {
      const msg = (e as Error).message;
      setErr(msg);
      if (mode === 'register' && msg.includes('مسجّل')) setTaken(true);
    } finally { setBusy(false); }
  };

  const help = whatsappUrl(settings.whatsapp, mode === 'login'
    ? `مرحبًا، نسيت الرمز السري لتطبيق DermaCare. رقمي: ${phone}`
    : `مرحبًا، أحاول التسجيل في تطبيق DermaCare والرقم ${phone} يظهر أنه مسجّل`);

  return (
    <div className="app" style={{ paddingBottom: 24 }}>
      {onBack && (
        <button className="btn sm" style={{ background: 'none', padding: 0, minHeight: 32, color: 'var(--muted)' }} onClick={onBack}>
          <span style={{ width: 18, display: 'block' }}>{Icon.back}</span> رجوع
        </button>
      )}
      <div className="welcome" style={{ minHeight: 'calc(100dvh - 160px)' }}>
        <img src="/logo.svg" alt="DermaCare" className="logo-big" style={{ width: 160 }} />

        <div className="chips" style={{ justifyContent: 'center', margin: '0 0 10px', padding: 0 }}>
          <button className={`chip${mode === 'register' ? ' on' : ''}`} onClick={() => switchMode('register')}>تسجيل جديد</button>
          <button className={`chip${mode === 'login' ? ' on' : ''}`} onClick={() => switchMode('login')}>لدي حساب</button>
        </div>

        <form onSubmit={submit} className="card rise" style={{ padding: 20 }} key={mode}>
          {mode === 'register' ? (
            <>
              <h1 style={{ fontSize: 21, marginBottom: 4 }}>أهلًا بك</h1>
              <p className="hint" style={{ marginBottom: 18 }}>سجّلي مرة واحدة فقط، وبعدها تحجزين بلمسة.</p>
              <label className="field">
                <span>الاسم الكامل</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="مثال: رنا خوري" />
              </label>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 21, marginBottom: 4 }}>أهلًا بعودتك</h1>
              <p className="hint" style={{ marginBottom: 18 }}>ادخلي برقم هاتفك ورمزك السري.</p>
            </>
          )}
          <label className="field">
            <span>رقم الهاتف</span>
            <input className="input ltr" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="05X-XXXXXXX" />
          </label>
          {mode === 'register' && (
            <label className="field">
              <span>تاريخ الميلاد 🎁 <span style={{ fontWeight: 400 }}>· لتصلك هدية في عيد ميلادك</span></span>
              <input className="input" type="date" value={birth} min={BIRTH_MIN} max={birthMax()} onChange={(e) => setBirth(e.target.value)} autoComplete="bday" />
            </label>
          )}
          <div className={mode === 'register' ? 'grid2' : ''}>
            <label className="field">
              <span>{mode === 'register' ? 'اختاري رمزًا سريًا (4 أرقام)' : 'الرمز السري'}</span>
              <input className="input otp" style={{ fontSize: 20, letterSpacing: 10 }} type="password" inputMode="numeric" autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={pin} onChange={(e) => setPin(onlyDigits(e.target.value))} placeholder="••••" />
            </label>
            {mode === 'register' && (
              <label className="field">
                <span>أعيدي كتابة الرمز</span>
                <input className="input otp" style={{ fontSize: 20, letterSpacing: 10 }} type="password" inputMode="numeric" autoComplete="new-password"
                  value={pin2} onChange={(e) => setPin2(onlyDigits(e.target.value))} placeholder="••••" />
              </label>
            )}
          </div>
          {mode === 'register' && <p className="hint" style={{ marginTop: -6, marginBottom: 14 }}>ستحتاجين الرمز فقط إذا دخلتِ من جهاز جديد.</p>}
          {api.mode === 'demo' && mode === 'login' && <p className="hint" style={{ marginBottom: 10 }}>نسخة تجريبية: 0521112233 والرمز 1111</p>}
          {err && <p className="error">{err}</p>}
          {taken && (
            <div className="row" style={{ marginBottom: 12 }}>
              <button type="button" className="btn soft sm" onClick={() => switchMode('login')}>دخول برمزي السري</button>
              <a className="btn ghost sm" href={help} target="_blank" rel="noreferrer" style={{ color: '#1f9d55' }}>{Icon.whatsapp} المركز</a>
            </div>
          )}
          <button className="btn primary block" disabled={busy}>{busy ? 'لحظة…' : mode === 'register' ? 'تسجيل' : 'دخول'}</button>
          {mode === 'login' && (
            <a className="hint" href={help} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', marginTop: 14 }}>
              نسيتِ الرمز السري؟ تواصلي مع المركز
            </a>
          )}
          {mode === 'register' && <p className="hint" style={{ marginTop: 12, textAlign: 'center' }}>نستخدم بياناتك لتأكيد مواعيدك وتذكيرك بها فقط.</p>}
        </form>
      </div>
    </div>
  );
}
