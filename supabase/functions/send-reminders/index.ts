// Sends a web-push reminder ~24h before each booked appointment.
// Schedule every 15 minutes (Supabase Dashboard → Cron, or pg_cron + pg_net).
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);

const time = new Intl.DateTimeFormat('ar', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem', numberingSystem: 'latn' });

Deno.serve(async () => {
  const until = new Date(Date.now() + 24 * 3_600_000).toISOString();
  const { data: appts, error } = await sb
    .from('appointments')
    .select('id,client_id,start_at,treatments(name)')
    .eq('status', 'booked')
    .is('reminded_at', null)
    .gt('start_at', new Date().toISOString())
    .lte('start_at', until);
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  // deno-lint-ignore no-explicit-any
  for (const a of appts as any[]) {
    const { data: subs } = await sb.from('push_subscriptions').select('endpoint,subscription').eq('client_id', a.client_id);
    const payload = JSON.stringify({
      title: 'تذكير بموعدك في DermaCare',
      body: `${a.treatments.name} — الساعة ${time.format(new Date(a.start_at))}`,
      url: '/',
    });
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(s.subscription, payload);
        sent++;
      } catch (e) {
        // deno-lint-ignore no-explicit-any
        if ((e as any).statusCode === 404 || (e as any).statusCode === 410) {
          await sb.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        }
      }
    }
    await sb.from('appointments').update({ reminded_at: new Date().toISOString() }).eq('id', a.id);
  }
  return Response.json({ appointments: appts?.length ?? 0, sent });
});
