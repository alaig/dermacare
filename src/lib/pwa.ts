import { api } from './api';

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** Ask the browser not to evict our storage (keeps the client signed in). Safe to call repeatedly. */
export async function persistStorage() {
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch { /* ignore */ }
}

/** Opened inside WhatsApp / Instagram / Facebook in-app browsers, which keep a separate, short-lived storage. */
export const inAppBrowser = () => /FBAN|FBAV|Instagram|WhatsApp|Line\//i.test(navigator.userAgent);

export function registerSW() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
}

function urlB64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Ask permission and subscribe to push reminders. Returns final state. */
export async function enableReminders(): Promise<'granted' | 'denied' | 'unsupported' | 'need-install'> {
  if (isIOS() && !isStandalone()) return 'need-install';
  if (!pushSupported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (reg && vapid) {
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(vapid) }));
    await api.savePushSubscription(sub.toJSON());
  } else if (reg) {
    // Demo: show a sample so the experience is visible
    reg.showNotification('تم تفعيل التذكيرات', { body: 'سنذكّرك قبل موعدك بيوم.', icon: '/icons/icon-192.png', dir: 'rtl', lang: 'ar' });
  }
  return 'granted';
}

export const remindersOn = () => pushSupported() && Notification.permission === 'granted';

/* read-state for messages, per device */
const READ_KEY = 'dermacare-read';
export function readIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]')); } catch { return new Set(); }
}
export function markRead(ids: string[]) {
  const s = readIds();
  ids.forEach((i) => s.add(i));
  try { localStorage.setItem(READ_KEY, JSON.stringify([...s])); } catch { /* ignore */ }
}
