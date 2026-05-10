'use strict';

// ── Constants ─────────────────────────────────────────────────────────────

const TIER_LABELS = { best: 'Best Friend', good: 'Good Friend', casual: 'Casual Friend' };

// ── State ─────────────────────────────────────────────────────────────────

let friends = [];
let editingId = null;
let deletingId = null;

// ── API helpers ───────────────────────────────────────────────────────────

async function api(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Utility ───────────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function el(id) { return document.getElementById(id); }

function formatSinceText(daysSince) {
  if (daysSince === 0) return 'Talked today';
  if (daysSince === 1) return 'Yesterday';
  return `${daysSince}d ago`;
}

function daysDisplay(friend) {
  if (friend.status === 'overdue') {
    const n = Math.abs(friend.days_remaining);
    return { value: n, label: `day${n === 1 ? '' : 's'} overdue` };
  }
  if (friend.days_remaining === 0) {
    return { value: 'Due', label: 'today' };
  }
  return { value: friend.days_remaining, label: `day${friend.days_remaining === 1 ? '' : 's'} left` };
}

// ── Render ────────────────────────────────────────────────────────────────

function renderStats() {
  const overdue = friends.filter(f => f.status === 'overdue').length;
  const soon    = friends.filter(f => f.status === 'soon').length;
  const good    = friends.filter(f => f.status === 'good').length;
  el('count-overdue').textContent = overdue;
  el('count-soon').textContent    = soon;
  el('count-good').textContent    = good;
}

function createCard(friend) {
  const { value, label } = daysDisplay(friend);
  const sinceText = formatSinceText(friend.days_since_contact);
  const barWidth  = friend.pct_remaining;

  const card = document.createElement('article');
  card.className = 'friend-card';
  card.dataset.id = friend.id;
  card.dataset.status = friend.status;

  card.innerHTML = `
    <div class="card-top">
      <div>
        <h3 class="friend-name">${esc(friend.name)}</h3>
        <span class="tier-badge tier-badge-${friend.tier}">${TIER_LABELS[friend.tier]}</span>
      </div>
      <div class="card-menu">
        <button class="card-menu-btn" aria-label="Options for ${esc(friend.name)}" aria-expanded="false">···</button>
        <div class="card-dropdown hidden" role="menu">
          <button class="dropdown-item js-edit" role="menuitem">Edit</button>
          <button class="dropdown-item dropdown-item-danger js-delete" role="menuitem">Remove</button>
        </div>
      </div>
    </div>

    <div class="status-area">
      <div class="days-row">
        <div>
          <span class="days-value status-${friend.status}">${value}</span>
          <span class="days-label">${label}</span>
        </div>
        <span class="last-talked">${sinceText}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill status-${friend.status}" style="width:${barWidth}%"></div>
      </div>
    </div>

    <div class="card-footer">
      <button class="talked-btn js-talked">We talked!</button>
    </div>`;

  // menu toggle
  const menuBtn  = card.querySelector('.card-menu-btn');
  const dropdown = card.querySelector('.card-dropdown');
  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    const open = !dropdown.classList.contains('hidden');
    closeAllDropdowns();
    if (!open) {
      dropdown.classList.remove('hidden');
      menuBtn.setAttribute('aria-expanded', 'true');
    }
  });

  card.querySelector('.js-edit').addEventListener('click', () => {
    closeAllDropdowns();
    openEditModal(friend);
  });

  card.querySelector('.js-delete').addEventListener('click', () => {
    closeAllDropdowns();
    openConfirmDelete(friend);
  });

  card.querySelector('.js-talked').addEventListener('click', () => markTalked(friend.id));

  return card;
}

function renderFriends() {
  const grid         = el('friends-grid');
  const loadingState = el('loading-state');
  const emptyState   = el('empty-state');

  // remove existing cards (keep loading + empty state nodes)
  Array.from(grid.children).forEach(child => {
    if (child !== loadingState && child !== emptyState) child.remove();
  });
  loadingState.classList.add('hidden');

  if (friends.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  const order = { overdue: 0, soon: 1, good: 2 };
  const sorted = [...friends].sort((a, b) => {
    const s = order[a.status] - order[b.status];
    return s !== 0 ? s : a.days_remaining - b.days_remaining;
  });

  const frag = document.createDocumentFragment();
  sorted.forEach(f => frag.appendChild(createCard(f)));
  grid.appendChild(frag);
}

// ── Data ──────────────────────────────────────────────────────────────────

async function loadFriends() {
  try {
    friends = await api('/api/friends');
    renderFriends();
    renderStats();
  } catch (err) {
    console.error('Failed to load friends:', err);
  }
}

async function markTalked(id) {
  try {
    const updated = await api(`/api/friends/${id}/talked`, { method: 'POST' });
    friends = friends.map(f => f.id === id ? updated : f);
    renderFriends();
    renderStats();
  } catch (err) {
    console.error('Failed to mark talked:', err);
  }
}

async function removeFriend(id) {
  try {
    await api(`/api/friends/${id}`, { method: 'DELETE' });
    friends = friends.filter(f => f.id !== id);
    renderFriends();
    renderStats();
  } catch (err) {
    console.error('Failed to remove friend:', err);
  }
}

// ── Friend modal ──────────────────────────────────────────────────────────

function openAddModal() {
  editingId = null;
  el('friend-modal-title').textContent = 'Add a friend';
  el('friend-submit').textContent      = 'Add friend';
  el('friend-id').value                = '';
  el('friend-name').value              = '';
  el('friend-last-contact').value      = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[name="tier"]').forEach(r => { r.checked = false; });
  openModal('friend-modal-backdrop');
  setTimeout(() => el('friend-name').focus(), 50);
}

function openEditModal(friend) {
  editingId = friend.id;
  el('friend-modal-title').textContent = 'Edit friend';
  el('friend-submit').textContent      = 'Save changes';
  el('friend-id').value                = friend.id;
  el('friend-name').value              = friend.name;
  el('friend-last-contact').value      = friend.last_contact;
  document.querySelectorAll('input[name="tier"]').forEach(r => {
    r.checked = r.value === friend.tier;
  });
  openModal('friend-modal-backdrop');
  setTimeout(() => el('friend-name').focus(), 50);
}

async function handleFriendSubmit(e) {
  e.preventDefault();
  const name         = el('friend-name').value.trim();
  const tier         = document.querySelector('input[name="tier"]:checked')?.value;
  const last_contact = el('friend-last-contact').value;

  if (!name || !tier || !last_contact) return;

  const submitBtn = el('friend-submit');
  submitBtn.disabled     = true;
  submitBtn.textContent  = 'Saving…';

  try {
    if (editingId) {
      const updated = await api(`/api/friends/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({ name, tier, last_contact }),
      });
      friends = friends.map(f => f.id === editingId ? updated : f);
    } else {
      const created = await api('/api/friends', {
        method: 'POST',
        body: JSON.stringify({ name, tier, last_contact }),
      });
      friends.push(created);
    }
    closeModal('friend-modal-backdrop');
    renderFriends();
    renderStats();
  } catch (err) {
    submitBtn.textContent = 'Error — try again';
    console.error(err);
  } finally {
    submitBtn.disabled = false;
    if (submitBtn.textContent === 'Saving…') {
      submitBtn.textContent = editingId ? 'Save changes' : 'Add friend';
    }
  }
}

// ── Confirm delete modal ──────────────────────────────────────────────────

function openConfirmDelete(friend) {
  deletingId = friend.id;
  el('confirm-name').textContent = friend.name;
  openModal('confirm-modal-backdrop');
}

// ── Settings modal ────────────────────────────────────────────────────────

async function openSettingsModal() {
  try {
    const s = await api('/api/settings');
    el('settings-enabled').checked    = !!s.notifications_enabled;
    el('settings-email').value        = s.email || '';
    el('settings-notify-time').value  = s.notify_time || '08:00';
    el('settings-smtp-host').value    = s.smtp_host || '';
    el('settings-smtp-port').value    = s.smtp_port || 587;
    el('settings-smtp-user').value    = s.smtp_user || '';
    el('settings-smtp-password').value = '';
    el('settings-message').classList.add('hidden');
    openModal('settings-modal-backdrop');
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function handleSettingsSubmit(e) {
  e.preventDefault();
  const body = {
    notifications_enabled: el('settings-enabled').checked,
    email:        el('settings-email').value.trim(),
    notify_time:  el('settings-notify-time').value,
    smtp_host:    el('settings-smtp-host').value.trim(),
    smtp_port:    parseInt(el('settings-smtp-port').value) || 587,
    smtp_user:    el('settings-smtp-user').value.trim(),
  };
  const pass = el('settings-smtp-password').value;
  if (pass) body.smtp_password = pass;

  try {
    await api('/api/settings', { method: 'PUT', body: JSON.stringify(body) });
    showSettingsMsg('Settings saved!', 'success');
    setTimeout(() => closeModal('settings-modal-backdrop'), 1200);
  } catch (err) {
    showSettingsMsg('Could not save settings. Please try again.', 'error');
  }
}

async function handleTestEmail() {
  const btn = el('test-email-btn');
  btn.disabled     = true;
  btn.textContent  = 'Sending…';
  try {
    await api('/api/settings/test-email', { method: 'POST' });
    showSettingsMsg('Test email sent! Check your inbox.', 'success');
  } catch (err) {
    showSettingsMsg(err.message, 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Send test';
  }
}

function showSettingsMsg(text, type) {
  const msgEl = el('settings-message');
  msgEl.textContent = text;
  msgEl.className   = `settings-message ${type}`;
  msgEl.classList.remove('hidden');
  clearTimeout(msgEl._timer);
  msgEl._timer = setTimeout(() => msgEl.classList.add('hidden'), 5000);
}

// ── Modal helpers ─────────────────────────────────────────────────────────

function openModal(id) {
  el(id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  el(id).classList.add('hidden');
  document.body.style.overflow = '';
}

function closeAllDropdowns() {
  document.querySelectorAll('.card-dropdown').forEach(d => d.classList.add('hidden'));
  document.querySelectorAll('.card-menu-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
}

// ── Boot ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadFriends();

  // Add-friend buttons (header + empty state)
  document.querySelectorAll('.add-friend-trigger').forEach(btn => {
    btn.addEventListener('click', openAddModal);
  });

  // Friend form
  el('friend-form').addEventListener('submit', handleFriendSubmit);

  // Settings trigger
  document.querySelector('.settings-trigger').addEventListener('click', openSettingsModal);

  // Settings form
  el('settings-form').addEventListener('submit', handleSettingsSubmit);
  el('test-email-btn').addEventListener('click', handleTestEmail);

  // SMTP presets
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el('settings-smtp-host').value = btn.dataset.host;
      el('settings-smtp-port').value = btn.dataset.port;
    });
  });

  // Confirm delete
  el('confirm-delete').addEventListener('click', async () => {
    if (!deletingId) return;
    await removeFriend(deletingId);
    deletingId = null;
    closeModal('confirm-modal-backdrop');
  });
  el('confirm-cancel').addEventListener('click', () => {
    deletingId = null;
    closeModal('confirm-modal-backdrop');
  });

  // Generic modal-close buttons (data-closes attribute)
  document.querySelectorAll('[data-closes]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closes));
  });

  // Click-outside-to-close for each backdrop
  ['friend-modal-backdrop', 'settings-modal-backdrop', 'confirm-modal-backdrop'].forEach(id => {
    el(id).addEventListener('click', e => {
      if (e.target === e.currentTarget) {
        closeModal(id);
        if (id === 'confirm-modal-backdrop') deletingId = null;
      }
    });
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    ['friend-modal-backdrop', 'settings-modal-backdrop', 'confirm-modal-backdrop'].forEach(closeModal);
    closeAllDropdowns();
    deletingId = null;
  });

  // Close dropdowns on outside click
  document.addEventListener('click', closeAllDropdowns);
});
