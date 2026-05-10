const cron = require('node-cron');
const { supabase, computeFriend } = require('./database');
const { sendReminderEmail } = require('./mailer');

async function runDailyCheck() {
  const { data: settings } = await supabase
    .from('settings').select('*').eq('id', 1).single();

  if (!settings?.notifications_enabled || !settings.email || !settings.smtp_host) return;

  const today = new Date().toISOString().split('T')[0];
  if (settings.last_notified === today) return;

  const { data: friends } = await supabase.from('friends').select('*');
  const computed = (friends || []).map(computeFriend);

  try {
    await sendReminderEmail(settings, computed);
    await supabase.from('settings').update({ last_notified: today }).eq('id', 1);
    console.log(`[frember] Reminder email sent at ${new Date().toLocaleString()}`);
  } catch (err) {
    console.error('[frember] Failed to send reminder email:', err.message);
  }
}

// Run every minute; fire check when clock matches notify_time
cron.schedule('* * * * *', async () => {
  const { data: settings } = await supabase
    .from('settings')
    .select('notifications_enabled, notify_time')
    .eq('id', 1)
    .single();

  if (!settings?.notifications_enabled) return;

  const [hh, mm] = (settings.notify_time || '08:00').split(':').map(Number);
  const now = new Date();
  if (now.getHours() === hh && now.getMinutes() === mm) {
    await runDailyCheck();
  }
});

console.log('[frember] Scheduler started');
