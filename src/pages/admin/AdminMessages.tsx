import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { Icon, useLoad, useToast } from '../../components/ui';
import { fmtShortDate } from '../../lib/time';

export default function AdminMessages() {
  const toast = useToast();
  const { data, reload } = useLoad(async () => {
    const [msgs, clients] = await Promise.all([api.listMessages(), api.listClients()]);
    return { msgs, names: new Map(clients.map((c) => [c.id, c.name])), clients };
  });
  const [to, setTo] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await api.sendMessage({ clientId: to || null, title: title.trim(), body: body.trim() });
    setTitle(''); setBody(''); setTo('');
    toast('تم نشر الرسالة');
    reload();
  };

  return (
    <>
      <h1 className="page-title">الرسائل</h1>
      <form className="card" onSubmit={send}>
        <label className="field"><span>إلى</span>
          <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">كل الزبائن</option>
            {data?.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field"><span>العنوان</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: مواعيد جديدة لشهر كانون الأول" />
        </label>
        <label className="field"><span>النص</span>
          <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <button className="btn primary block" disabled={!title.trim()}>نشر الرسالة</button>
      </form>

      <div className="section-title">المرسلة</div>
      {!data ? <div className="hint">جارٍ التحميل…</div> : data.msgs.length === 0 ? <div className="card empty">لا توجد رسائل</div> : data.msgs.map((m) => (
        <div key={m.id} className="card msg">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div className="meta">{fmtShortDate(m.createdAt)} · {m.clientId ? `إلى ${data.names.get(m.clientId) ?? 'زبونة'}` : 'إلى الجميع'}</div>
            <button className="btn sm" style={{ background: 'none', padding: 0, minHeight: 0, color: 'var(--coral-deep)' }}
              onClick={async () => { if (confirm('حذف الرسالة؟')) { await api.deleteMessage(m.id); reload(); } }} aria-label="حذف">
              <span style={{ width: 18, display: 'block' }}>{Icon.x}</span>
            </button>
          </div>
          <h3>{m.title}</h3>
          {m.body && <p>{m.body}</p>}
        </div>
      ))}
    </>
  );
}
