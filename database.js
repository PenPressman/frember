require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

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

module.exports = { supabase, computeFriend, TIER_DAYS };
