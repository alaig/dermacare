import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { DAY_NAMES, addDays, fmtTime, freeSlots, sameDay, startOfDay } from '../lib/time';
import type { Settings, Treatment } from '../lib/types';

/** Date strip + free time slots for a treatment. */
export default function SlotPicker({ treatment, settings, value, onChange, days = 21 }: {
  treatment: Treatment; settings: Settings; value: string | null; onChange: (iso: string | null) => void; days?: number;
}) {
  const today = startOfDay(new Date());
  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDays(today, i)), [days, today.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const firstOpen = dates.find((d) => settings.workHours[d.getDay()]) ?? today;
  const [day, setDay] = useState<Date>(firstOpen);
  const [slots, setSlots] = useState<Date[] | null>(null);

  useEffect(() => {
    let alive = true;
    setSlots(null);
    const from = startOfDay(day);
    api.busyIntervals(from.toISOString(), addDays(from, 1).toISOString()).then((busy) => {
      if (alive) setSlots(freeSlots(day, treatment.durationMin, settings, busy));
    });
    return () => { alive = false; };
  }, [day, treatment.id, treatment.durationMin, settings]);

  const month = new Intl.DateTimeFormat('ar', { month: 'long', year: 'numeric' }).format(day);

  return (
    <div>
      <div className="section-title" style={{ marginTop: 6 }}>{month}</div>
      <div className="chips">
        {dates.map((d) => (
          <button key={d.toISOString()} type="button" className={`day${sameDay(d, day) ? ' on' : ''}`}
            disabled={!settings.workHours[d.getDay()]} onClick={() => { setDay(d); onChange(null); }}>
            <small>{sameDay(d, today) ? 'اليوم' : DAY_NAMES[d.getDay()]}</small>
            <b>{d.getDate()}</b>
          </button>
        ))}
      </div>
      <div className="section-title">الأوقات المتاحة</div>
      {slots === null ? (
        <div className="hint" style={{ padding: 12 }}>جارٍ التحميل…</div>
      ) : slots.length === 0 ? (
        <div className="card empty">لا توجد أوقات متاحة في هذا اليوم</div>
      ) : (
        <div className="slots">
          {slots.map((t) => {
            const iso = t.toISOString();
            return (
              <button key={iso} type="button" className={`slot${value === iso ? ' on' : ''}`} onClick={() => onChange(iso)}>
                {fmtTime(iso)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
