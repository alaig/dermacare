// Live backend on Supabase. Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY,
// and the schema in supabase/migrations.
import { createClient } from '@supabase/supabase-js';
import type { Api, Appointment, AppointmentFull, ApptStatus, Client, ClientWithStats, Message, Settings, Treatment } from './types';
import { DEFAULT_SETTINGS } from './demo';
import { toE164 } from './time';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
export const sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });

/* eslint-disable @typescript-eslint/no-explicit-any */
const ok = <T>(r: { data: T; error: any }): T => {
  if (r.error) throw new Error(friendly(r.error.message));
  return r.data;
};

function friendly(msg: string) {
  if (/no_overlap|conflicting key|exclusion/i.test(msg)) return 'هذا الموعد لم يعد متاحًا، اختاري وقتًا آخر';
  if (/phone provider|sms/i.test(msg)) return 'خدمة الرسائل غير مفعّلة حاليًا، تواصلي مع المركز للحجز';
  if (/rate limit|too many/i.test(msg)) return 'محاولات كثيرة، انتظري دقيقة وحاولي مجددًا';
  if (/token|otp/i.test(msg)) return 'الرمز غير صحيح أو انتهت صلاحيته';
  return msg;
}

// Errors while *sending* the SMS: keep Twilio's reason visible so problems can be diagnosed.
function sendError(msg: string) {
  if (/rate limit|too many|seconds/i.test(msg)) return 'محاولات كثيرة، انتظري دقيقة وحاولي مجددًا';
  if (/phone provider/i.test(msg)) return 'خدمة الرسائل غير مفعّلة حاليًا، تواصلي مع المركز للحجز';
  if (/60200|invalid parameter `?to/i.test(msg)) return 'رقم الهاتف غير صالح، تأكدي منه';
  if (/21608|compliance profile|unverified/i.test(msg)) return 'خدمة الرسائل قيد التفعيل حاليًا. للحجز تواصلي مع المركز هاتفيًا أو عبر واتساب';
  console.error('OTP send failed:', msg);
  return 'تعذّر إرسال رسالة التحقق، حاولي بعد قليل أو تواصلي مع المركز';
}

const mapT = (r: any): Treatment => ({ id: r.id, name: r.name, durationMin: r.duration_min, price: r.price, active: r.active });
const mapC = (r: any): Client => ({ id: r.id, name: r.name, phone: r.phone, birthDate: r.birth_date ?? null, createdAt: r.created_at });
const mapA = (r: any): Appointment => ({
  id: r.id, clientId: r.client_id, treatmentId: r.treatment_id, start: r.start_at, end: r.end_at,
  status: r.status, prepaid: r.prepaid, createdAt: r.created_at,
});
const mapFull = (r: any): AppointmentFull => ({ ...mapA(r), client: mapC(r.clients), treatment: mapT(r.treatments) });
const mapM = (r: any): Message => ({ id: r.id, clientId: r.client_id, title: r.title, body: r.body, createdAt: r.created_at, kind: r.kind ?? 'manual' });

const APPT_SELECT = '*, clients(*), treatments(*)';

export const liveApi: Api = {
  mode: 'live',

  async getSettings() {
    const row = ok(await sb.from('settings').select('data').eq('id', 1).maybeSingle());
    const s: Settings = { ...DEFAULT_SETTINGS, ...(row?.data ?? {}), calendarToken: '' };
    if (await liveApi.isAdmin()) {
      const sec = ok(await sb.from('admin_secrets').select('calendar_token').eq('id', 1).maybeSingle());
      s.calendarToken = sec?.calendar_token ?? '';
    }
    return s;
  },
  async listTreatments(all) {
    let q = sb.from('treatments').select('*').order('sort').order('name');
    if (!all) q = q.eq('active', true);
    return (ok(await q) ?? []).map(mapT);
  },
  async busyIntervals(from, to) {
    const rows = ok(await sb.rpc('busy_intervals', { p_from: from, p_to: to })) as any[];
    return rows.map((r) => ({ start: r.start_at, end: r.end_at }));
  },

  async currentClient() {
    const { data } = await sb.auth.getSession();
    if (!data.session) return null;
    const row = ok(await sb.from('clients').select('*').eq('user_id', data.session.user.id).maybeSingle());
    return row ? mapC(row) : null;
  },
  async requestOtp(phone) {
    const { error } = await sb.auth.signInWithOtp({ phone: toE164(phone) });
    if (error) throw new Error(sendError(error.message));
  },
  async verifyOtp(phone, code, name, birthDate) {
    const { error } = await sb.auth.verifyOtp({ phone: toE164(phone), token: code, type: 'sms' });
    if (error) throw new Error(friendly(error.message));
    const row = ok(await sb.rpc('claim_client', { p_name: name, p_birth: birthDate }));
    return mapC(row);
  },
  async setMyBirthDate(date) { ok(await sb.rpc('set_my_birth_date', { p_birth: date })); },
  async signOut() { await sb.auth.signOut(); },
  async book(treatmentId, startISO) {
    return mapA(ok(await sb.rpc('book_appointment', { p_treatment: treatmentId, p_start: startISO })));
  },
  async myAppointments() {
    // RLS limits rows to the signed-in client
    return (ok(await sb.from('appointments').select(APPT_SELECT).order('start_at')) as any[]).map(mapFull);
  },
  async cancelAppointment(id) { ok(await sb.rpc('cancel_appointment', { p_id: id })); },
  async myMessages() {
    return (ok(await sb.from('messages').select('*').order('created_at', { ascending: false })) as any[]).map(mapM);
  },
  async myVisits() {
    const r = await sb.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'completed');
    if (r.error) throw new Error(r.error.message);
    return r.count ?? 0;
  },
  async savePushSubscription(sub) {
    ok(await sb.rpc('save_push_subscription', { p_sub: sub }));
  },

  async isAdmin() {
    const { data } = await sb.auth.getSession();
    if (!data.session) return false;
    const r = await sb.rpc('is_admin');
    return r.data === true;
  },
  async adminSignIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error('بيانات الدخول غير صحيحة');
    if (!(await liveApi.isAdmin())) { await sb.auth.signOut(); throw new Error('هذا الحساب ليس حساب إدارة'); }
  },
  async adminSignOut() { await sb.auth.signOut(); },
  async listAppointments(from, to) {
    return (ok(await sb.from('appointments').select(APPT_SELECT).gte('start_at', from).lt('start_at', to).order('start_at')) as any[]).map(mapFull);
  },
  async setAppointmentStatus(id, status: ApptStatus) { ok(await sb.from('appointments').update({ status }).eq('id', id)); },
  async setPrepaid(id, prepaid) { ok(await sb.from('appointments').update({ prepaid }).eq('id', id)); },
  async adminBook(name, phone, treatmentId, startISO) {
    ok(await sb.rpc('admin_book', { p_name: name, p_phone: phone, p_treatment: treatmentId, p_start: startISO }));
  },
  async listClients(): Promise<ClientWithStats[]> {
    const clients = (ok(await sb.from('clients').select('*').order('name')) as any[]).map(mapC);
    const appts = ok(await sb.from('appointments').select('client_id,status,start_at')) as any[];
    const nowIso = new Date().toISOString();
    return clients.map((c) => {
      const mine = appts.filter((a) => a.client_id === c.id);
      const done = mine.filter((a) => a.status === 'completed').map((a) => a.start_at).sort().reverse();
      const next = mine.filter((a) => a.status === 'booked' && a.start_at >= nowIso).map((a) => a.start_at).sort()[0];
      return { ...c, visits: done.length, lastVisit: done[0] ?? null, nextAppt: next ?? null };
    });
  },
  async listMessages() {
    return (ok(await sb.from('messages').select('*').order('created_at', { ascending: false })) as any[]).map(mapM);
  },
  async sendMessage(m) { ok(await sb.from('messages').insert({ client_id: m.clientId, title: m.title, body: m.body })); },
  async deleteMessage(id) { ok(await sb.from('messages').delete().eq('id', id)); },
  async saveSettings(s) {
    const { calendarToken: _t, ...data } = s;
    ok(await sb.from('settings').upsert({ id: 1, data }));
  },
  async saveTreatment(t) {
    const row = { name: t.name, duration_min: t.durationMin, price: t.price, active: t.active };
    if (t.id) ok(await sb.from('treatments').update(row).eq('id', t.id));
    else ok(await sb.from('treatments').insert(row));
  },
  async setClientBirthDate(clientId, date) { ok(await sb.from('clients').update({ birth_date: date }).eq('id', clientId)); },
  async sendBirthdaysNow() { return (ok(await sb.rpc('admin_send_birthdays')) as number) ?? 0; },
  calendarFeedUrl(token) {
    return `${url.replace(/^https:/, 'webcal:')}/functions/v1/calendar-feed?token=${encodeURIComponent(token)}`;
  },
};
