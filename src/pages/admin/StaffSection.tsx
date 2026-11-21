import { useState } from 'react';
import { api } from '../../lib/api';
import { Icon, Sheet, initials, useLoad, useToast } from '../../components/ui';
import type { Staff } from '../../lib/types';

const cleanUser = (v: string) => v.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30);

/** Dashboard users: add, rename username, change password, remove. */
export default function StaffSection() {
  const toast = useToast();
  const { data, reload, error } = useLoad(() => api.listStaff());
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<Staff | null>(null);

  return (
    <>
      <div className="section-title">مستخدمو لوحة الإدارة</div>
      {error && <p className="error">{error.includes('admin_list_users') ? 'يجب تنفيذ ملف 005_staff_users.sql في Supabase' : error}</p>}
      <div className="list">
        {data?.map((u) => (
          <button key={u.id} className="item" style={{ width: '100%', border: 0, background: 'none', textAlign: 'start', cursor: 'pointer' }} onClick={() => setEdit(u)}>
            <span className="avatar">{initials(u.name || u.username || u.email || '؟')}</span>
            <span className="grow">
              <span className="t" style={{ display: 'block' }}>{u.name || u.username || u.email} {u.isMe && <span className="tag" style={{ marginInlineStart: 4 }}>أنت</span>}</span>
              <span className="s" dir="ltr" style={{ display: 'block', textAlign: 'right' }}>{u.username ?? u.email}</span>
              {!u.username && <span className="tag warn" style={{ marginTop: 4 }}>يدخل بالإيميل · أضيفي له اسم مستخدم</span>}
            </span>
            <span style={{ width: 18, color: 'var(--rose)', transform: 'scaleX(-1)' }}>{Icon.back}</span>
          </button>
        ))}
      </div>
      <button className="btn soft block" style={{ marginTop: 10 }} onClick={() => setAdding(true)}>{Icon.plus} إضافة مستخدم</button>

      <AddStaff open={adding} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); toast('تمت إضافة المستخدم'); }} />
      <EditStaff u={edit} onClose={() => setEdit(null)} onDone={(msg) => { setEdit(null); reload(); toast(msg); }} />
    </>
  );
}

function AddStaff({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [user, setUser] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr(''); setBusy(true);
    try { await api.createStaff(name.trim(), user, pw); setName(''); setUser(''); setPw(''); onDone(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose}>
      <h2 style={{ fontSize: 19, marginBottom: 14 }}>مستخدم جديد</h2>
      <label className="field"><span>الاسم (للعرض)</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: سماح - الاستقبال" /></label>
      <label className="field"><span>اسم المستخدم (للدخول)</span>
        <input className="input ltr" value={user} onChange={(e) => setUser(cleanUser(e.target.value))} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="samah" />
      </label>
      <label className="field"><span>كلمة السر (8 أحرف على الأقل)</span>
        <input className="input ltr" type="text" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" autoCapitalize="none" />
      </label>
      <p className="hint" style={{ marginTop: -6, marginBottom: 12 }}>حروف إنجليزية صغيرة وأرقام فقط. أرسلي اسم المستخدم وكلمة السر للموظفة بنفسك.</p>
      {err && <p className="error">{err}</p>}
      <button className="btn primary block" disabled={busy || user.length < 3 || pw.length < 8} onClick={submit}>{busy ? 'لحظة…' : 'إضافة'}</button>
    </Sheet>
  );
}

function EditStaff({ u, onClose, onDone }: { u: Staff | null; onClose: () => void; onDone: (msg: string) => void }) {
  const [user, setUser] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [last, setLast] = useState<string | null>(null);
  if (u && u.id !== last) { setLast(u.id); setUser(u.username ?? ''); setPw(''); setErr(''); }
  if (!u) return null;
  const run = async (fn: () => Promise<void>, msg: string) => {
    setErr('');
    try { await fn(); onDone(msg); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <Sheet open onClose={onClose}>
      <h2 style={{ fontSize: 19, marginBottom: 4 }}>{u.name || u.username || u.email}</h2>
      {u.isMe && <p className="hint" style={{ marginBottom: 10 }}>هذا حسابك</p>}

      <div className="section-title" style={{ marginTop: 10 }}>اسم المستخدم</div>
      <div className="row">
        <input className="input ltr" style={{ flex: 2 }} value={user} onChange={(e) => setUser(cleanUser(e.target.value))} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="username" />
        <button className="btn soft" disabled={user.length < 3 || user === u.username} onClick={() => run(() => api.setStaffUsername(u.id, user), 'تم حفظ اسم المستخدم')}>حفظ</button>
      </div>
      {!u.username && <p className="hint" style={{ marginTop: 6 }}>بعد الحفظ يصبح الدخول باسم المستخدم بدل الإيميل.</p>}

      <div className="section-title">كلمة سر جديدة</div>
      <div className="row">
        <input className="input ltr" style={{ flex: 2 }} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" autoCapitalize="none" placeholder="8 أحرف على الأقل" />
        <button className="btn soft" disabled={pw.length < 8} onClick={() => run(() => api.setStaffPassword(u.id, pw), 'تم تغيير كلمة السر')}>تغيير</button>
      </div>

      {err && <p className="error" style={{ marginTop: 12 }}>{err}</p>}
      {!u.isMe && (
        <button className="btn danger block" style={{ marginTop: 20 }}
          onClick={() => { if (confirm(`حذف المستخدم ${u.name || u.username}؟ لن يستطيع الدخول للوحة الإدارة.`)) run(() => api.deleteStaff(u.id), 'تم حذف المستخدم'); }}>
          {Icon.trash} حذف المستخدم
        </button>
      )}
    </Sheet>
  );
}
