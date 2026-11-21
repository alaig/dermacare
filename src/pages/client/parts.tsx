import { useState } from 'react';
import { Icon, Sheet, useToast } from '../../components/ui';
import { downloadIcs, googleCalendarUrl, whatsappUrl } from '../../lib/calendar';
import { enableReminders, inAppBrowser, isIOS, isStandalone, remindersOn } from '../../lib/pwa';
import type { AppointmentFull, Settings } from '../../lib/types';
import { fmtDate, fmtTime } from '../../lib/time';

export function CalendarButtons({ a, s, dark }: { a: AppointmentFull; s: Settings; dark?: boolean }) {
  const cls = dark ? 'btn light sm' : 'btn soft sm';
  return (
    <div className="row">
      <a className={cls} href={googleCalendarUrl(a, s)} target="_blank" rel="noreferrer">{Icon.google} Google</a>
      <button className={cls} onClick={() => downloadIcs(a, s)}>{Icon.apple} Apple</button>
    </div>
  );
}

export function PrepayButton({ a, s }: { a: AppointmentFull; s: Settings }) {
  if (!s.prepayUrl || a.prepaid) return a.prepaid ? <span className="tag ok">{Icon.check} مدفوع مسبقًا</span> : null;
  const price = a.treatment.price ? ` · ₪${a.treatment.price}` : '';
  return (
    <a className="btn primary sm block" href={s.prepayUrl} target="_blank" rel="noreferrer">
      {Icon.card} دفع مسبق عبر بيت{price}
    </a>
  );
}

export function ContactRow({ s, text }: { s: Settings; text?: string }) {
  return (
    <div className="contact">
      <a href={`tel:${s.phone}`}>
        <span className="ci" style={{ background: 'var(--blush)', color: 'var(--navy)' }}>{Icon.phone}</span>
        اتصال
      </a>
      <a href={whatsappUrl(s.whatsapp, text)} target="_blank" rel="noreferrer">
        <span className="ci" style={{ background: '#dff5e6', color: '#1f9d55' }}>{Icon.whatsapp}</span>
        واتساب
      </a>
    </div>
  );
}

export function RemindersCard() {
  const [on, setOn] = useState(remindersOn());
  const [installHelp, setInstallHelp] = useState(false);
  const toast = useToast();
  if (on) return null;
  const enable = async () => {
    const r = await enableReminders();
    if (r === 'granted') { setOn(true); toast('تم تفعيل التذكيرات'); }
    else if (r === 'need-install') setInstallHelp(true);
    else if (r === 'denied') toast('لم يتم السماح بالإشعارات من إعدادات المتصفح');
    else toast('المتصفح لا يدعم الإشعارات، سنذكّرك عبر واتساب');
  };
  return (
    <>
      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span className="avatar" style={{ background: 'var(--blush)' }}>{Icon.bell}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>ذكّريني قبل الموعد</div>
          <div className="hint">إشعار قبل موعدك بيوم</div>
        </div>
        <button className="btn dark sm" onClick={enable}>تفعيل</button>
      </div>
      <InstallSheet open={installHelp} onClose={() => setInstallHelp(false)} />
    </>
  );
}

export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <h2 style={{ fontSize: 19, marginBottom: 8 }}>ثبّتي التطبيق على الشاشة الرئيسية</h2>
      <p className="hint" style={{ marginBottom: 16 }}>على الآيفون، إضافة التطبيق إلى الشاشة الرئيسية تُبقيك مسجّلة دخول دائمًا وتتيح التذكيرات. خطوتان فقط:</p>
      <div className="list">
        <div className="item"><span className="avatar">1</span><div className="grow">اضغطي زر المشاركة <span style={{ display: 'inline-block', width: 18, verticalAlign: 'middle' }}>{Icon.share}</span> أسفل الشاشة</div></div>
        <div className="item"><span className="avatar">2</span><div className="grow">اختاري «إضافة إلى الشاشة الرئيسية»</div></div>
        <div className="item"><span className="avatar">3</span><div className="grow">افتحي DermaCare من الأيقونة واضغطي «تفعيل» مرة أخرى</div></div>
      </div>
      <button className="btn dark block" style={{ marginTop: 16 }} onClick={onClose}>فهمت</button>
    </Sheet>
  );
}

export function InstallBanner() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem('dc-install-hide') === '1'; } catch { return false; }
  });
  if (isStandalone() || hidden) return null;
  if (inAppBrowser()) {
    return (
      <div className="card" style={{ background: 'var(--warn-bg)', boxShadow: 'none', marginBottom: 12 }}>
        <b style={{ color: 'var(--warn)' }}>افتحي التطبيق في المتصفح</b>
        <p className="hint" style={{ color: 'var(--warn)', marginTop: 4 }}>
          فتحتِ الرابط من داخل تطبيق آخر، وهناك قد يُطلب منك الدخول كل مرة. اضغطي ⋯ في الأعلى واختاري «فتح في Safari» أو «فتح في Chrome».
        </p>
      </div>
    );
  }
  return (
    <>
      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--blush-2)', marginBottom: 12 }}>
        <img src="/icons/icon-192.png" alt="" width={40} height={40} style={{ borderRadius: 10 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>DermaCare على شاشتك</div>
          <div className="hint">ابقي مسجّلة دخول دائمًا، بدون تحميل</div>
        </div>
        <button className="btn dark sm" onClick={() => setOpen(true)}>كيف؟</button>
        <button className="btn sm" style={{ background: 'none', padding: 4, minHeight: 0 }} aria-label="إخفاء" onClick={() => { setHidden(true); try { localStorage.setItem('dc-install-hide', '1'); } catch { /* */ } }}>
          <span style={{ width: 18, display: 'block' }}>{Icon.x}</span>
        </button>
      </div>
      {isIOS() ? (
        <InstallSheet open={open} onClose={() => setOpen(false)} />
      ) : (
        <Sheet open={open} onClose={() => setOpen(false)}>
          <h2 style={{ fontSize: 19, marginBottom: 8 }}>تثبيت التطبيق</h2>
          <p className="hint" style={{ marginBottom: 16 }}>من قائمة المتصفح (⋮) اختاري «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</p>
          <button className="btn dark block" onClick={() => setOpen(false)}>فهمت</button>
        </Sheet>
      )}
    </>
  );
}

export function whatsappApptText(a: AppointmentFull) {
  return `مرحبًا، بخصوص موعدي (${a.treatment.name}) يوم ${fmtDate(a.start)} الساعة ${fmtTime(a.start)}`;
}
