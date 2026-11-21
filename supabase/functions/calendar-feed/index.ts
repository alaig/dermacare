// Subscribable ICS feed of all booked appointments for the center owner.
// Add once in Google Calendar ("From URL") or Apple Calendar ("New Calendar Subscription").
// Deploy with: supabase functions deploy calendar-feed --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const d = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  const { data: sec } = await sb.from('admin_secrets').select('calendar_token').eq('id', 1).single();
  if (!sec || !token || token !== sec.calendar_token) return new Response('forbidden', { status: 403 });

  const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: rows, error } = await sb
    .from('appointments')
    .select('id,start_at,end_at,status,prepaid,clients(name,phone),treatments(name)')
    .gte('start_at', from)
    .in('status', ['booked', 'completed'])
    .order('start_at');
  if (error) return new Response(error.message, { status: 500 });

  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DermaCare//AR', 'X-WR-CALNAME:DermaCare', 'REFRESH-INTERVAL;VALUE=DURATION:PT15M', 'X-PUBLISHED-TTL:PT15M'];
  // deno-lint-ignore no-explicit-any
  for (const a of rows as any[]) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${a.id}@dermacare`,
      `DTSTAMP:${d(new Date().toISOString())}`,
      `DTSTART:${d(a.start_at)}`,
      `DTEND:${d(a.end_at)}`,
      `SUMMARY:${esc(`${a.clients.name} — ${a.treatments.name}`)}`,
      `DESCRIPTION:${esc(`هاتف: ${a.clients.phone}${a.prepaid ? '\nمدفوع مسبقًا' : ''}`)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return new Response(lines.join('\r\n'), { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
});
