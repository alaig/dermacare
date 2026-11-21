import { createContext, useContext, useEffect, useState, type FormEvent } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Settings } from '../../lib/types';
import { Icon, TabBar } from '../../components/ui';
import Agenda from './Agenda';
import Clients from './Clients';
import AdminMessages from './AdminMessages';
import AdminSettings from './AdminSettings';

interface Ctx { settings: Settings; setSettings: (s: Settings) => void; signOut: () => void }
const C = createContext<Ctx>(null as unknown as Ctx);
export const useAdmin = () => useContext(C);

export default function AdminApp() {
  const [ok, setOk] = useState<boolean | undefined>(undefined);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => { api.isAdmin().then(setOk); }, []);
  useEffect(() => { if (ok) api.getSettings().then(setSettings); }, [ok]);

  if (ok === undefined) return <div className="splash"><img src="/mark.svg" alt="" /></div>;
  if (!ok) return <AdminLogin onDone={() => setOk(true)} />;
  if (!settings) return <div className="splash"><img src="/mark.svg" alt="" /></div>;

  const signOut = async () => { await api.adminSignOut(); setOk(false); };

  return (
    <C.Provider value={{ settings, setSettings, signOut }}>
      <div className="app">
        <Routes>
          <Route index element={<Agenda />} />
          <Route path="clients" element={<Clients />} />
          <Route path="messages" element={<AdminMessages />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
      <TabBar
        tabs={[
          { to: '/admin', label: 'المواعيد', icon: Icon.calendar, end: true },
          { to: '/admin/clients', label: 'الزبائن', icon: Icon.users },
          { to: '/admin/messages', label: 'الرسائل', icon: Icon.chat },
          { to: '/admin/settings', label: 'الإعدادات', icon: Icon.settings },
        ]}
      />
    </C.Provider>
  );
}

function AdminLogin({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api.adminSignIn(email, pw); onDone(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <div className="app" style={{ paddingBottom: 24 }}>
      <div className="welcome">
        <img src="/logo.svg" alt="DermaCare" className="logo-big" />
        <form onSubmit={submit} className="card" style={{ padding: 20 }}>
          <h1 style={{ fontSize: 21, marginBottom: 16 }}>دخول الإدارة</h1>
          <label className="field"><span>البريد الإلكتروني</span>
            <input className="input ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </label>
          <label className="field"><span>كلمة المرور</span>
            <input className="input ltr" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
          </label>
          {api.mode === 'demo' && <p className="hint" style={{ marginBottom: 10 }}>نسخة تجريبية: أي بريد، وكلمة المرور admin</p>}
          {err && <p className="error">{err}</p>}
          <button className="btn dark block" disabled={busy}>{busy ? 'لحظة…' : 'دخول'}</button>
        </form>
      </div>
    </div>
  );
}
