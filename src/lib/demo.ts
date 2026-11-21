// Demo backend: everything lives in localStorage so the app can be tried without a server.
// OTP code is always 1234; admin login is any email + password "admin".
import type { Api, Appointment, AppointmentFull, Client, ClientWithStats, Message, Settings, Treatment } from './types';
import { addDays, startOfDay } from './time';
import { BIRTHDAY_DEFAULTS, isBirthdayToday, renderGreeting, todayKey } from './birthday';

const KEY = 'dermacare-demo-v4';
const uid = () => Math.random().toString(36).slice(2, 10);

interface DB {
  settings: Settings;
  treatments: Treatment[];
  clients: Client[];
  appointments: Appointment[];
  messages: Message[];
  session: { clientId: string | null; admin: boolean };
  pins?: Record<string, string>; // phone -> pin
  staff?: { id: string; username: string; name: string; password: string }[];
  staffId?: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  centerName: 'DermaCare',
  phone: '0501234567',
  whatsapp: '972501234567',
  address: 'الناصرة، شارع بولس السادس',
  prepayUrl: 'https://www.bitpay.co.il/',
  loyaltyEnabled: true,
  loyaltyTarget: 10,
  loyaltyReward: 'الزيارة العاشرة هدية من المركز',
  slotMinutes: 30,
  workHours: [
    { open: '09:00', close: '19:00' },
    { open: '09:00', close: '19:00' },
    { open: '09:00', close: '19:00' },
    { open: '09:00', close: '19:00' },
    { open: '09:00', close: '19:00' },
    { open: '09:00', close: '14:00' },
    null,
  ],
  calendarToken: 'demo-token',
  ...BIRTHDAY_DEFAULTS,
};

function seed(): DB {
  const treatments: Treatment[] = [
    { id: 't1', name: 'إزالة شعر بالليزر', durationMin: 30, price: 250, active: true },
    { id: 't2', name: 'تنظيف بشرة عميق', durationMin: 60, price: 300, active: true },
    { id: 't3', name: 'تقشير كيميائي', durationMin: 45, price: 350, active: true },
    { id: 't4', name: 'علاج حب الشباب', durationMin: 45, price: 280, active: true },
    { id: 't5', name: 'استشارة أولى', durationMin: 15, price: 0, active: true },
  ];
  const now = new Date();
  const bd = (yearsAgo: number, dayOffset: number) => {
    const d = addDays(now, dayOffset);
    return todayKey(new Date(d.getFullYear() - yearsAgo, d.getMonth(), d.getDate()));
  };
  const clients: Client[] = [
    { id: 'c1', name: 'رنا خوري', phone: '0521112233', birthDate: bd(29, 40), approved: true, createdAt: addDays(now, -200).toISOString() },
    { id: 'c2', name: 'ميس عثامنة', phone: '0542223344', birthDate: bd(34, 0), approved: true, createdAt: addDays(now, -150).toISOString() },
    { id: 'c3', name: 'لينا حداد', phone: '0503334455', birthDate: bd(25, 3), approved: true, createdAt: addDays(now, -90).toISOString() },
    { id: 'c4', name: 'سمر زعبي', phone: '0524445566', birthDate: null, approved: false, createdAt: addDays(now, -30).toISOString() },
  ];
  const appointments: Appointment[] = [];
  const mk = (clientId: string, treatmentId: string, dayOffset: number, hour: number, status: Appointment['status']) => {
    const s = startOfDay(addDays(now, dayOffset));
    s.setHours(hour, 0, 0, 0);
    const t = treatments.find((x) => x.id === treatmentId)!;
    appointments.push({
      id: uid(), clientId, treatmentId, start: s.toISOString(),
      end: new Date(s.getTime() + t.durationMin * 60_000).toISOString(),
      status, prepaid: false, createdAt: s.toISOString(),
    });
  };
  for (let i = 0; i < 9; i++) mk('c1', 't1', -180 + i * 18, 10, 'completed');
  for (let i = 0; i < 6; i++) mk('c2', i % 2 ? 't2' : 't1', -140 + i * 20, 12, 'completed');
  for (let i = 0; i < 3; i++) mk('c3', 't3', -80 + i * 25, 15, 'completed');
  mk('c1', 't1', 0, 16, 'booked');
  mk('c2', 't2', 1, 11, 'booked');
  mk('c3', 't3', 1, 14, 'booked');
  mk('c4', 't5', 2, 10, 'pending');
  // a fuller month so the overview charts have something to show
  const hoursPattern = [10, 11, 12, 15, 16, 17, 18, 11, 16, 17];
  const treatPattern = ['t1', 't1', 't2', 't1', 't3', 't4', 't1', 't2', 't5', 't1', 't3'];
  const who = ['c1', 'c2', 'c3'];
  let k = 0;
  for (let off = -28; off <= 30; off++) {
    const day = addDays(now, off);
    if (day.getDay() === 6) continue; // closed on Saturday
    const per = 1 + ((off + 40) % 3);
    for (let j = 0; j < per; j++, k++) {
      const h = hoursPattern[k % hoursPattern.length];
      if (day.getDay() === 5 && h >= 14) continue;
      const st = new Date(startOfDay(day)); st.setHours(h, 0, 0, 0);
      const t = treatments.find((x) => x.id === treatPattern[k % treatPattern.length])!;
      const en = new Date(st.getTime() + t.durationMin * 60_000);
      if (appointments.some((a) => st < new Date(a.end) && en > new Date(a.start))) continue;
      const past = en < now;
      appointments.push({
        id: uid(), clientId: who[k % who.length], treatmentId: t.id, start: st.toISOString(), end: en.toISOString(),
        status: past ? (k % 9 === 0 ? 'no_show' : 'completed') : 'booked', prepaid: k % 4 === 0, createdAt: st.toISOString(),
      });
    }
  }
  const messages: Message[] = [
    { id: uid(), clientId: null, title: 'أهلًا بك في تطبيق DermaCare', body: 'من هنا تحجزين موعدك، وتتابعين زياراتك، وتصلك رسائلنا أولًا بأول.', createdAt: addDays(now, -3).toISOString() },
    { id: uid(), clientId: null, title: 'تنبيه قبل جلسة الليزر', body: 'يُرجى حلاقة المنطقة قبل الجلسة بـ 24 ساعة، وتجنّب التعرض للشمس أسبوعًا قبلها.', createdAt: addDays(now, -1).toISOString() },
  ];
  return { settings: DEFAULT_SETTINGS, treatments, clients, appointments, messages, session: { clientId: null, admin: false }, pins: { '0521112233': '1111', '0542223344': '2222', '0503334455': '3333', '0524445566': '4444' } };
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const db = seed();
  save(db);
  return db;
}
function save(db: DB) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ }
}

/** Demo stand-in for the daily database job: greet everyone whose birthday is today, once a year. */
function runBirthdays(db: DB): number {
  const s = { ...DEFAULT_SETTINGS, ...db.settings };
  if (!s.birthdayEnabled) return 0;
  const year = String(new Date().getFullYear());
  let n = 0;
  for (const c of db.clients) {
    if (!isBirthdayToday(c.birthDate)) continue;
    if (db.messages.some((m) => m.kind === 'birthday' && m.clientId === c.id && m.createdAt.startsWith(year))) continue;
    db.messages.push({
      id: uid(), clientId: c.id, kind: 'birthday', createdAt: new Date().toISOString(),
      title: renderGreeting(s.birthdayTitle, c.name, s.birthdayGift),
      body: renderGreeting(s.birthdayBody, c.name, s.birthdayGift),
    });
    n++;
  }
  if (n) save(db);
  return n;
}

export const STAFF_ERR: Record<string, string> = {
  bad_username: 'اسم المستخدم: 3-30 حرفًا إنجليزيًا صغيرًا أو أرقامًا (مسموح . _ -)',
  short_password: 'كلمة السر يجب أن تكون 8 أحرف على الأقل',
  username_taken: 'اسم المستخدم مستعمل، اختاري اسمًا آخر',
  cannot_delete_self: 'لا يمكن حذف حسابك أنت',
  last_admin: 'يجب أن يبقى مستخدم واحد على الأقل',
  not_staff: 'المستخدم غير موجود',
};

const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));

function full(db: DB, a: Appointment): AppointmentFull {
  return { ...a, client: db.clients.find((c) => c.id === a.clientId)!, treatment: db.treatments.find((t) => t.id === a.treatmentId)! };
}

function overlaps(db: DB, start: string, end: string) {
  const s = new Date(start).getTime(), e = new Date(end).getTime();
  return db.appointments.some((a) => (a.status === 'booked' || a.status === 'pending') && s < new Date(a.end).getTime() && e > new Date(a.start).getTime());
}

function insertAppt(db: DB, clientId: string, treatmentId: string, startISO: string, status: Appointment['status'] = 'booked'): Appointment {
  const t = db.treatments.find((x) => x.id === treatmentId);
  if (!t) throw new Error('العلاج غير موجود');
  const end = new Date(new Date(startISO).getTime() + t.durationMin * 60_000).toISOString();
  if (overlaps(db, startISO, end)) throw new Error('هذا الموعد لم يعد متاحًا، اختاري وقتًا آخر');
  const a: Appointment = { id: uid(), clientId, treatmentId, start: startISO, end, status, prepaid: false, createdAt: new Date().toISOString() };
  db.appointments.push(a);
  return a;
}

export const demoApi: Api = {
  mode: 'demo',
  async getSettings() { return { ...DEFAULT_SETTINGS, ...load().settings }; },
  async listTreatments(all) { const db = load(); return all ? db.treatments : db.treatments.filter((t) => t.active); },
  async busyIntervals(from, to) {
    const db = load(); const f = new Date(from).getTime(), t = new Date(to).getTime();
    return db.appointments.filter((a) => (a.status === 'booked' || a.status === 'pending') && new Date(a.start).getTime() < t && new Date(a.end).getTime() > f).map((a) => ({ start: a.start, end: a.end }));
  },

  async currentClient() { const db = load(); return db.clients.find((c) => c.id === db.session.clientId) ?? null; },
  async requestOtp() { await wait(400); },
  async verifyOtp(phone, code, name, birthDate) {
    await wait(300);
    if (code !== '1234') throw new Error('الرمز غير صحيح');
    const db = load();
    let c = db.clients.find((x) => x.phone === phone);
    if (!c) { c = { id: uid(), name, phone, birthDate, approved: false, createdAt: new Date().toISOString() }; db.clients.push(c); }
    else { if (name) c.name = name; if (birthDate) c.birthDate = birthDate; }
    db.session.clientId = c.id; save(db); return c;
  },
  async registerClient(name, phone, birthDate, pin) {
    await wait(300);
    const db = load(); db.pins ??= {};
    const existing = db.clients.find((x) => x.phone === phone);
    if (existing && db.pins[phone]) throw new Error('هذا الرقم مسجّل في التطبيق. إذا كان رقمك، ادخلي برمزك السري أو تواصلي مع المركز');
    let c = existing;
    if (c) { c.approved = false; c.name = name; c.birthDate = birthDate; }
    else { c = { id: uid(), name, phone, birthDate, approved: false, createdAt: new Date().toISOString() }; db.clients.push(c); }
    db.pins[phone] = pin; db.session.clientId = c.id; save(db); return c;
  },
  async loginClient(phone, pin) {
    await wait(300);
    const db = load();
    const c = db.clients.find((x) => x.phone === phone);
    if (!c || db.pins?.[phone] !== pin) throw new Error('رقم الهاتف أو الرمز السري غير صحيح');
    db.session.clientId = c.id; save(db); return c;
  },
  async setMyBirthDate(date) {
    const db = load(); const c = db.clients.find((x) => x.id === db.session.clientId);
    if (c) c.birthDate = date; save(db);
  },
  async signOut() { const db = load(); db.session.clientId = null; save(db); },
  async book(treatmentId, startISO) {
    const db = load(); if (!db.session.clientId) throw new Error('يجب تسجيل الدخول');
    const me = db.clients.find((x) => x.id === db.session.clientId);
    const a = insertAppt(db, db.session.clientId, treatmentId, startISO, me?.approved ? 'booked' : 'pending'); save(db); return a;
  },
  async myAppointments() {
    const db = load();
    return db.appointments.filter((a) => a.clientId === db.session.clientId).map((a) => full(db, a)).sort((a, b) => a.start.localeCompare(b.start));
  },
  async cancelAppointment(id) {
    const db = load(); const a = db.appointments.find((x) => x.id === id && x.clientId === db.session.clientId);
    if (a) a.status = 'cancelled'; save(db);
  },
  async myMessages() {
    const db = load(); runBirthdays(db);
    return db.messages.filter((m) => m.clientId === null || m.clientId === db.session.clientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async myVisits() { const db = load(); return db.appointments.filter((a) => a.clientId === db.session.clientId && a.status === 'completed').length; },
  async savePushSubscription() { /* demo: nothing to store */ },

  async isAdmin() { return load().session.admin; },
  async adminSignIn(login, password) {
    await wait(300);
    const db = load(); db.staff ??= [{ id: 's1', username: 'admin', name: 'المدير', password: 'admin' }];
    const u = db.staff.find((x) => x.username === login.trim().toLowerCase() && x.password === password);
    if (!u) throw new Error('اسم المستخدم أو كلمة السر غير صحيحة');
    db.session.admin = true; db.staffId = u.id; save(db);
  },
  async adminSignOut() { const db = load(); db.session.admin = false; db.staffId = null; save(db); },
  async listStaff() {
    const db = load(); db.staff ??= [{ id: 's1', username: 'admin', name: 'المدير', password: 'admin' }];
    return db.staff.map((x) => ({ id: x.id, username: x.username, name: x.name, email: null, isMe: x.id === (db.staffId ?? 's1') }));
  },
  async createStaff(name, username, password) {
    const db = load(); db.staff ??= [{ id: 's1', username: 'admin', name: 'المدير', password: 'admin' }];
    const u = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(u)) throw new Error(STAFF_ERR.bad_username);
    if (password.length < 8) throw new Error(STAFF_ERR.short_password);
    if (db.staff.some((x) => x.username === u)) throw new Error(STAFF_ERR.username_taken);
    db.staff.push({ id: uid(), username: u, name, password }); save(db);
  },
  async setStaffPassword(id, password) {
    if (password.length < 8) throw new Error(STAFF_ERR.short_password);
    const db = load(); const x = db.staff?.find((s) => s.id === id); if (x) x.password = password; save(db);
  },
  async setStaffUsername(id, username) {
    const db = load(); const u = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(u)) throw new Error(STAFF_ERR.bad_username);
    if (db.staff?.some((x) => x.username === u && x.id !== id)) throw new Error(STAFF_ERR.username_taken);
    const x = db.staff?.find((s) => s.id === id); if (x) x.username = u; save(db);
  },
  async deleteStaff(id) {
    const db = load();
    if (id === (db.staffId ?? 's1')) throw new Error(STAFF_ERR.cannot_delete_self);
    if ((db.staff?.length ?? 0) <= 1) throw new Error(STAFF_ERR.last_admin);
    db.staff = db.staff?.filter((x) => x.id !== id); save(db);
  },
  async listAppointments(from, to) {
    const db = load();
    return db.appointments.filter((a) => a.start >= from && a.start < to).map((a) => full(db, a)).sort((a, b) => a.start.localeCompare(b.start));
  },
  async clientAppointments(clientId) {
    const db = load();
    return db.appointments.filter((a) => a.clientId === clientId).map((a) => full(db, a)).sort((a, b) => a.start.localeCompare(b.start));
  },
  async setAppointmentStatus(id, status) { const db = load(); const a = db.appointments.find((x) => x.id === id); if (a) a.status = status; save(db); },
  async setPrepaid(id, prepaid) { const db = load(); const a = db.appointments.find((x) => x.id === id); if (a) a.prepaid = prepaid; save(db); },
  async adminBook(name, phone, treatmentId, startISO) {
    const db = load();
    let c = db.clients.find((x) => x.phone === phone);
    if (!c) { c = { id: uid(), name, phone, birthDate: null, approved: true, createdAt: new Date().toISOString() }; db.clients.push(c); }
    insertAppt(db, c.id, treatmentId, startISO); save(db);
  },
  async listClients(): Promise<ClientWithStats[]> {
    const db = load(); const nowIso = new Date().toISOString();
    return db.clients.map((c) => {
      const mine = db.appointments.filter((a) => a.clientId === c.id);
      const done = mine.filter((a) => a.status === 'completed').sort((a, b) => b.start.localeCompare(a.start));
      const next = mine.filter((a) => a.status === 'booked' && a.start >= nowIso).sort((a, b) => a.start.localeCompare(b.start))[0];
      return { ...c, visits: done.length, lastVisit: done[0]?.start ?? null, nextAppt: next?.start ?? null };
    });
  },
  async listMessages() { const db = load(); runBirthdays(db); return db.messages.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
  async sendMessage(m) { const db = load(); db.messages.push({ ...m, id: uid(), createdAt: new Date().toISOString() }); save(db); },
  async deleteMessage(id) { const db = load(); db.messages = db.messages.filter((m) => m.id !== id); save(db); },
  async saveSettings(s) { const db = load(); db.settings = s; save(db); },
  async saveTreatment(t) {
    const db = load(); const i = db.treatments.findIndex((x) => x.id === t.id);
    if (i >= 0) db.treatments[i] = t; else db.treatments.push({ ...t, id: t.id || uid() });
    save(db);
  },
  async deleteTreatment(id) {
    const db = load();
    if (db.appointments.some((a) => a.treatmentId === id)) {
      const t = db.treatments.find((x) => x.id === id); if (t) t.active = false; save(db); return 'hidden';
    }
    db.treatments = db.treatments.filter((x) => x.id !== id); save(db); return 'deleted';
  },
  async setClientBirthDate(clientId, date) {
    const db = load(); const c = db.clients.find((x) => x.id === clientId);
    if (c) c.birthDate = date; save(db);
  },
  async sendBirthdaysNow() { return runBirthdays(load()); },
  async approveClient(id) {
    const db = load(); const c = db.clients.find((x) => x.id === id); if (c) c.approved = true;
    db.appointments.forEach((a) => { if (a.clientId === id && a.status === 'pending') a.status = 'booked'; }); save(db);
  },
  async rejectClient(id) {
    const db = load(); const c = db.clients.find((x) => x.id === id); if (!c) return;
    if (db.pins) delete db.pins[c.phone];
    db.clients = db.clients.filter((x) => x.id !== id);
    db.appointments = db.appointments.filter((a) => a.clientId !== id);
    if (db.session.clientId === id) db.session.clientId = null;
    save(db);
  },
  async resetPin(id, pin) {
    const db = load(); const c = db.clients.find((x) => x.id === id); if (!c) return;
    db.pins ??= {}; db.pins[c.phone] = pin; save(db);
  },
  calendarFeedUrl() { return ''; },
};

export function resetDemo() { localStorage.removeItem(KEY); }
