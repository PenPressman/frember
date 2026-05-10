const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const adapter = new FileSync(path.join(__dirname, 'frember.json'));
const db = low(adapter);

db.defaults({
  friends: [],
  settings: {
    email: '',
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    notify_time: '08:00',
    notifications_enabled: false,
    last_notified: '',
  },
}).write();

const TIER_DAYS = { best: 90, good: 35, casual: 21 };

function computeFriend(friend) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastContact = new Date(friend.last_contact + 'T00:00:00');
  const daysSince = Math.round((today - lastContact) / (1000 * 60 * 60 * 24));
  const tierDays = TIER_DAYS[friend.tier];
  const daysRemaining = tierDays - daysSince;
  const pctRemaining = Math.max(0, Math.min(100, (daysRemaining / tierDays) * 100));

  let status;
  if (daysRemaining < 0) {
    status = 'overdue';
  } else if (pctRemaining <= 25) {
    status = 'soon';
  } else {
    status = 'good';
  }

  return {
    ...friend,
    days_since_contact: daysSince,
    tier_days: tierDays,
    days_remaining: daysRemaining,
    pct_remaining: Math.round(pctRemaining),
    status,
  };
}

function nextId() {
  const friends = db.get('friends').value();
  if (friends.length === 0) return 1;
  return Math.max(...friends.map(f => f.id)) + 1;
}

module.exports = { db, computeFriend, TIER_DAYS, nextId };
