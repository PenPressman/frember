const express = require('express');
const path = require('path');
const { db, computeFriend, nextId } = require('./database');
const { sendTestEmail } = require('./mailer');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Friends ──────────────────────────────────────────────────────────────────

app.get('/api/friends', (req, res) => {
  const friends = db.get('friends').value().map(computeFriend);
  friends.sort((a, b) => a.days_remaining - b.days_remaining);
  res.json(friends);
});

app.post('/api/friends', (req, res) => {
  const { name, tier, last_contact } = req.body;
  if (!name || !tier || !last_contact) {
    return res.status(400).json({ error: 'name, tier, and last_contact are required' });
  }
  if (!['best', 'good', 'casual'].includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  const friend = {
    id: nextId(),
    name: name.trim(),
    tier,
    last_contact,
    created_at: new Date().toISOString(),
  };

  db.get('friends').push(friend).write();
  res.status(201).json(computeFriend(friend));
});

app.put('/api/friends/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.get('friends').find({ id }).value();
  if (!existing) return res.status(404).json({ error: 'Friend not found' });

  const tier = req.body.tier ?? existing.tier;
  if (!['best', 'good', 'casual'].includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  const updates = {
    name: req.body.name?.trim() ?? existing.name,
    tier,
    last_contact: req.body.last_contact ?? existing.last_contact,
  };

  db.get('friends').find({ id }).assign(updates).write();
  const updated = db.get('friends').find({ id }).value();
  res.json(computeFriend(updated));
});

app.delete('/api/friends/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const before = db.get('friends').value().length;
  db.get('friends').remove({ id }).write();
  const after = db.get('friends').value().length;
  if (before === after) return res.status(404).json({ error: 'Friend not found' });
  res.status(204).send();
});

app.post('/api/friends/:id/talked', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.get('friends').find({ id }).value();
  if (!existing) return res.status(404).json({ error: 'Friend not found' });

  const today = new Date().toISOString().split('T')[0];
  db.get('friends').find({ id }).assign({ last_contact: today }).write();
  const updated = db.get('friends').find({ id }).value();
  res.json(computeFriend(updated));
});

// ── Settings ─────────────────────────────────────────────────────────────────

app.get('/api/settings', (req, res) => {
  const s = db.get('settings').value();
  const { smtp_password, ...safe } = s;
  res.json(safe);
});

app.put('/api/settings', (req, res) => {
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

  db.get('settings').assign(updates).write();
  res.json({ success: true });
});

app.post('/api/settings/test-email', async (req, res) => {
  const s = db.get('settings').value();
  if (!s.email || !s.smtp_host || !s.smtp_user) {
    return res.status(400).json({ error: 'Save your email and SMTP settings first.' });
  }
  try {
    await sendTestEmail(s);
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
