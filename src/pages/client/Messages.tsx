import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useLoad } from '../../components/ui';
import { fmtShortDate } from '../../lib/time';
import { markRead, readIds } from '../../lib/pwa';
import { useClient } from './ClientApp';
import { ContactRow } from './parts';

export default function Messages() {
  const { settings: s, refreshUnread } = useClient();
  const { data } = useLoad(() => api.myMessages());
  const [unreadAtOpen, setUnreadAtOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!data) return;
    const r = readIds();
    setUnreadAtOpen(new Set(data.filter((m) => !r.has(m.id)).map((m) => m.id)));
    markRead(data.map((m) => m.id));
    refreshUnread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <>
      <h1 className="page-title">رسائل المركز</h1>
      {!data ? <div className="hint">جارٍ التحميل…</div> : data.length === 0 ? (
        <div className="card empty">لا توجد رسائل بعد</div>
      ) : data.map((m) => (
        <div key={m.id} className={`card msg${unreadAtOpen.has(m.id) ? ' unread' : ''}`}>
          <div className="meta">{fmtShortDate(m.createdAt)}{m.clientId ? ' · لكِ خصيصًا' : ''}</div>
          <h3>{m.title}</h3>
          {m.body && <p>{m.body}</p>}
        </div>
      ))}
      <div className="section-title">عندك سؤال؟</div>
      <ContactRow s={s} />
    </>
  );
}
