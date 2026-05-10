require('dotenv').config();
const express = require('express');
const path = require('path');
const { supabase, computeFriend } = require('./database');
const { sendTestEmail } = require('./mailer');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Friends ──────────────────────────────────────────────────────────────────

app.get('/api/friends', async (req, res) => {
  const { data, error } = await supabase.from('friends').select('*');
  if (error) return res.status(500).json({ error: error.message });

  const friends = data.map(computeFriend);
  friends.sort((a, b) => a.days_remaining - b.days_remaining);
  res.json(friends);
});

app.post('/api/friends', async (req, res) => {
  const { name, tier, last_contact } = req.body;
  if (!name || !tier || !last_contact) {
    return res.status(400).json({ error: 'name, tier, and last_contact are required' });
  }
  if (!['best', 'good', 'casual'].includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  const { data, error } = await supabase
    .from('friends')
    .insert({ name: name.trim(), tier, last_contact })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(computeFriend(data));
});

app.put('/api/friends/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { data: existing, error: fetchErr } = await supabase
    .from('friends').select('*').eq('id', id).single();

  if (fetchErr || !existing) return res.status(404).json({ error: 'Friend not found' });

  const tier = req.body.tier ?? existing.tier;
  if (!['best', 'good', 'casual'].includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  const updates = {
    name: req.body.name?.trim() ?? existing.name,
    tier,
    last_contact: req.body.last_contact ?? existing.last_contact,
  };

  const { data, error } = await supabase
    .from('friends').update(updates).eq('id', id).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(computeFriend(data));
});

app.delete('/api/friends/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { error } = await supabase.from('friends').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

app.post('/api/friends/:id/talked', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('friends').update({ last_contact: today }).eq('id', id).select().single();

  if (error || !data) return res.status(404).json({ error: 'Friend not found' });
  res.json(computeFriend(data));
});

// ── Settings ─────────────────────────────────────────────────────────────────

async function getSettings() {
  const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
  return data;
}

app.get('/api/settings', async (req, res) => {
  const settings = await getSettings();
  if (!settings) return res.status(500).json({ error: 'Settings not found' });

  const { smtp_password, ...safe } = settings;
  res.json(safe);
});

app.put('/api/settings', async (req, res) => {
  const {
    email, smtp_host, smtp_port, smtp_user, smtp_password,
    notify_time, notifications_enabled,
  } = req.body;

  const updates = {};
  if (email !== undefined)                 updates.email = email;
  if (smtp_host !== undefined)             updates.smtp_host = smtp_host;
  if (smtp_port !== undefined)             updates.smtp_port = smtp_port;
  if (smtp_user !== undefined)             updates.smtp_user = smtp_user;
  if (smtp_password !== undefined)         updates.smtp_password = smtp_password;
  if (notify_time !== undefined)           updates.notify_time = notify_time;
  if (notifications_enabled !== undefined) updates.notifications_enabled = !!notifications_enabled;

  const { error } = await supabase.from('settings').update(updates).eq('id', 1);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post('/api/settings/test-email', async (req, res) => {
  const settings = await getSettings();
  if (!settings?.email || !settings?.smtp_host || !settings?.smtp_user) {
    return res.status(400).json({ error: 'Save your email and SMTP settings first.' });
  }
  try {
    await sendTestEmail(settings);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[frember] Running at http://localhost:${PORT}`);
  require('./scheduler');
});
