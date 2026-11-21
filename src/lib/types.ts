export type DayHours = { open: string; close: string } | null;

export interface Settings {
  centerName: string;
  phone: string; // e.g. 0501234567
  whatsapp: string; // international, digits only: 972501234567
  address: string;
  prepayUrl: string; // Bit / payment-provider link; empty = hide button
  loyaltyEnabled: boolean; // shown to clients?
  loyaltyTarget: number; // e.g. 10 -> the 10th visit is a gift
  loyaltyReward: string;
  slotMinutes: number;
  workHours: DayHours[]; // index 0 = Sunday
  calendarToken: string; // secret for admin ICS feed
  birthdayEnabled: boolean; // auto-send a birthday greeting
  birthdayGift: string; // same gift for everyone, set by the owner
  birthdayTitle: string; // supports {الاسم} and {الهدية}
  birthdayBody: string;
}

export interface Treatment {
  id: string;
  name: string;
  durationMin: number;
  price: number | null;
  active: boolean;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  birthDate: string | null; // YYYY-MM-DD
  createdAt: string;
}

export type ApptStatus = 'booked' | 'completed' | 'cancelled' | 'no_show';

export interface Appointment {
  id: string;
  clientId: string;
  treatmentId: string;
  start: string; // ISO
  end: string; // ISO
  status: ApptStatus;
  prepaid: boolean;
  createdAt: string;
}

export interface AppointmentFull extends Appointment {
  client: Client;
  treatment: Treatment;
}

export interface Message {
  id: string;
  clientId: string | null; // null = broadcast to everyone
  title: string;
  body: string;
  createdAt: string;
  kind?: 'manual' | 'birthday';
}

export interface ClientWithStats extends Client {
  visits: number;
  lastVisit: string | null;
  nextAppt: string | null;
}

export interface Interval {
  start: string;
  end: string;
}

export interface Api {
  mode: 'demo' | 'live';
  // shared
  getSettings(): Promise<Settings>;
  listTreatments(includeInactive?: boolean): Promise<Treatment[]>;
  busyIntervals(dayStartISO: string, dayEndISO: string): Promise<Interval[]>;

  // client
  currentClient(): Promise<Client | null>;
  requestOtp(phone: string): Promise<void>;
  verifyOtp(phone: string, code: string, name: string, birthDate: string | null): Promise<Client>;
  setMyBirthDate(date: string): Promise<void>;
  signOut(): Promise<void>;
  book(treatmentId: string, startISO: string): Promise<Appointment>;
  myAppointments(): Promise<AppointmentFull[]>;
  cancelAppointment(id: string): Promise<void>;
  myMessages(): Promise<Message[]>;
  myVisits(): Promise<number>;
  savePushSubscription(sub: PushSubscriptionJSON): Promise<void>;

  // admin
  isAdmin(): Promise<boolean>;
  adminSignIn(email: string, password: string): Promise<void>;
  adminSignOut(): Promise<void>;
  listAppointments(fromISO: string, toISO: string): Promise<AppointmentFull[]>;
  setAppointmentStatus(id: string, status: ApptStatus): Promise<void>;
  setPrepaid(id: string, prepaid: boolean): Promise<void>;
  adminBook(name: string, phone: string, treatmentId: string, startISO: string): Promise<void>;
  listClients(): Promise<ClientWithStats[]>;
  listMessages(): Promise<Message[]>;
  sendMessage(m: Omit<Message, 'id' | 'createdAt'>): Promise<void>;
  deleteMessage(id: string): Promise<void>;
  saveSettings(s: Settings): Promise<void>;
  saveTreatment(t: Treatment): Promise<void>;
  setClientBirthDate(clientId: string, date: string | null): Promise<void>;
  sendBirthdaysNow(): Promise<number>;
  calendarFeedUrl(token: string): string;
}
