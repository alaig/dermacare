import type { Settings } from './types';

export const BIRTHDAY_DEFAULTS = {
  birthdayEnabled: true,
  birthdayGift: 'جلسة تنظيف بشرة مجانية',
  birthdayTitle: 'عيد ميلاد سعيد يا {الاسم} 🎂',
  birthdayBody: 'كل عام وأنتِ بخير! بمناسبة عيد ميلادك، هديتك من DermaCare: {الهدية}.\nالهدية صالحة لمدة شهر، احجزي موعدك من التطبيق.',
} satisfies Partial<Settings>;

const pad = (n: number) => String(n).padStart(2, '0');
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Month/day of the birthday as celebrated in `year` (Feb 29 -> Feb 28 in non-leap years). */
function celebratedOn(birth: string, year: number): Date {
  const [, m, d] = birth.split('-').map(Number);
  if (m === 2 && d === 29 && !isLeap(year)) return new Date(year, 1, 28);
  return new Date(year, m - 1, d);
}

export function isBirthdayToday(birth: string | null, now = new Date()): boolean {
  if (!birth) return false;
  const c = celebratedOn(birth, now.getFullYear());
  return c.getMonth() === now.getMonth() && c.getDate() === now.getDate();
}

/** Days until the next birthday (0 = today). */
export function daysToBirthday(birth: string | null, now = new Date()): number | null {
  if (!birth) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = celebratedOn(birth, today.getFullYear());
  if (next < today) next = celebratedOn(birth, today.getFullYear() + 1);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

export function renderGreeting(tpl: string, name: string, gift: string) {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return tpl.replaceAll('{الاسم}', first).replaceAll('{الهدية}', gift);
}

const bdFmt = new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'long' });
export const fmtBirthday = (birth: string) => {
  const [y, m, d] = birth.split('-').map(Number);
  return bdFmt.format(new Date(y, m - 1, d));
};

/** Reasonable bounds for the date input. */
export const BIRTH_MIN = '1930-01-01';
export const birthMax = () => todayKey(new Date(new Date().getFullYear() - 12, 11, 31));
