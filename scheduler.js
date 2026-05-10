const cron = require('node-cron');
const { db, computeFriend } = require('./database');
const { sendReminderEmail } = require('./mailer');

function runDailyCheck() {
  const settings = db.get('settings').value();
  if (!settings.notifications_enabled || !settings.email || !settings.smtp_host) return;

  const today = new Date().toISOString().split('T')[0];
  if (settings.last_notified === today) return;

  const friends = db.get('friends').value().map(computeFriend);

  sendReminderEmail(settings, friends)
    .then(() => {
      db.get('settings').assign({ last_notified: today }).write();
      console.log(`[frember] Reminder email sent at ${new Date().toLocaleString()}`);
    })
    .catch(err => {
      console.error('[frember] Failed to send reminder email:', err.message);
    });
}

// Fire once per minute; only trigger when clock matches notify_time
cron.schedule('* * * * *', () => {
  const settings = db.get('settings').value();
  if (!settings.notifications_enabled) return;

  const [hh, mm] = (settings.notify_time || '08:00').split(':').map(Number);
  const now = new Date();
  if (now.getHours() === hh && now.getMinutes() === mm) {
    runDailyCheck();
  }
});

console.log('[frember] Scheduler started');
