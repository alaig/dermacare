import type { Interval, Settings } from './types';

export const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const dateFmt = new Intl.DateTimeFormat('ar', { weekday: 'long', day: 'numeric', month: 'long' });
const shortDateFmt = new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('ar', { hour: '2-digit', minute: '2-digit', hour12: false, numberingSystem: 'latn' });

export const fmtDate = (iso: string) => dateFmt.format(new Date(iso));
export const fmtShortDate = (iso: string) => shortDateFmt.format(new Date(iso));
export const fmtTime = (iso: string) => timeFmt.format(new Date(iso));

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function atTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const x = new Date(day);
  x.setHours(h, m, 0, 0);
  return x;
}

/** Free start times for a treatment of `durationMin` on `day`. */
export function freeSlots(day: Date, durationMin: number, settings: Settings, busy: Interval[], now = new Date()): Date[] {
  const hours = settings.workHours[day.getDay()];
  if (!hours) return [];
  const open = atTime(day, hours.open);
  const close = atTime(day, hours.close);
  const step = settings.slotMinutes * 60_000;
  const dur = durationMin * 60_000;
  const minStart = now.getTime() + 60 * 60_000; // at least 1h ahead
  const busyMs = busy.map((b) => [new Date(b.start).getTime(), new Date(b.end).getTime()]);
  const out: Date[] = [];
  for (let t = open.getTime(); t + dur <= close.getTime(); t += step) {
    if (t < minStart) continue;
    const e = t + dur;
    if (busyMs.some(([bs, be]) => t < be && e > bs)) continue;
    out.push(new Date(t));
  }
  return out;
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  past: boolean;
}

export function countdown(targetISO: string, now = Date.now()): Countdown {
  let diff = Math.max(0, new Date(targetISO).getTime() - now);
  const days = Math.floor(diff / 86_400_000);
  diff -= days * 86_400_000;
  const hours = Math.floor(diff / 3_600_000);
  diff -= hours * 3_600_000;
  const minutes = Math.floor(diff / 60_000);
  const seconds = Math.floor((diff - minutes * 60_000) / 1000);
  return { days, hours, minutes, seconds, past: new Date(targetISO).getTime() <= now };
}

/** Normalise Israeli phone input to 05XXXXXXXX. Returns null if invalid. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('972')) d = '0' + d.slice(3);
  if (!/^05\d{8}$/.test(d)) return null;
  return d;
}

export const toE164 = (local: string) => '+972' + local.slice(1);
