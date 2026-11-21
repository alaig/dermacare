import type { AppointmentFull, Settings } from './types';

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export function googleCalendarUrl(a: AppointmentFull, s: Settings): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${a.treatment.name} — ${s.centerName}`,
    dates: `${icsDate(a.start)}/${icsDate(a.end)}`,
    details: `موعدك في ${s.centerName}. للتواصل: ${s.phone}`,
    location: s.address,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function appointmentIcs(a: AppointmentFull, s: Settings): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DermaCare//AR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${a.id}@dermacare`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(a.start)}`,
    `DTEND:${icsDate(a.end)}`,
    `SUMMARY:${esc(`${a.treatment.name} — ${s.centerName}`)}`,
    `LOCATION:${esc(s.address)}`,
    `DESCRIPTION:${esc(`للتواصل: ${s.phone}`)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc('تذكير بموعدك غدًا')}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc('موعدك بعد ساعتين')}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Apple Calendar / iOS: opening an .ics file offers "Add to Calendar". */
export function downloadIcs(a: AppointmentFull, s: Settings) {
  const blob = new Blob([appointmentIcs(a, s)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'dermacare-appointment.ics';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function whatsappUrl(number: string, text = '') {
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
