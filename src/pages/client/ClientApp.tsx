import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Client, Settings } from '../../lib/types';
import { Icon, TabBar } from '../../components/ui';
import { persistStorage, readIds } from '../../lib/pwa';
import Login from './Login';
import Welcome from './Welcome';
import Home from './Home';
import Book from './Book';
import Appointments from './Appointments';
import Messages from './Messages';

interface Ctx {
  client: Client;
  setClient: (c: Client) => void;
  settings: Settings;
  unread: number;
  refreshUnread: () => void;
  signOut: () => void;
}
const C = createContext<Ctx>(null as unknown as Ctx);
export const useClient = () => useContext(C);

export default function ClientApp() {
  const [client, setClient] = useState<Client | null | undefined>(undefined);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [unread, setUnread] = useState(0);
  const [loginTarget, setLoginTarget] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.currentClient(), api.getSettings()]).then(([c, s]) => { setClient(c); setSettings(s); });
  }, []);

  const refreshUnread = () => {
    api.myMessages().then((ms) => { const r = readIds(); setUnread(ms.filter((m) => !r.has(m.id)).length); }).catch(() => {});
  };
  useEffect(() => { if (client) { refreshUnread(); persistStorage(); } }, [client]);

  if (client === undefined || !settings) return <div className="splash"><img src="/mark.svg" alt="" /></div>;
  if (!client) {
    if (!loginTarget) return <Welcome onPick={setLoginTarget} />;
    return (
      <Login
        settings={settings}
        initialMode={loginTarget === '/appointments' ? 'login' : 'register'}
        onBack={() => setLoginTarget(null)}
        onDone={(c) => { setClient(c); navigate(loginTarget, { replace: true }); setLoginTarget(null); }}
      />
    );
  }

  const signOut = async () => { await api.signOut(); setClient(null); };

  return (
    <C.Provider value={{ client, setClient, settings, unread, refreshUnread, signOut }}>
      <div className="app">
        <Routes>
          <Route index element={<Home />} />
          <Route path="book" element={<Book />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="messages" element={<Messages />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <TabBar
        tabs={[
          { to: '/', label: 'الرئيسية', icon: Icon.home, end: true },
          { to: '/book', label: 'احجزي', icon: Icon.plus, cta: true },
          { to: '/appointments', label: 'زياراتي', icon: Icon.calendar },
          { to: '/messages', label: 'الرسائل', icon: Icon.chat, badge: unread },
        ]}
      />
    </C.Provider>
  );
}
