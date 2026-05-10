-- Run this once in the Supabase SQL Editor before starting Frember.
-- Dashboard → SQL Editor → New query → paste → Run

CREATE TABLE IF NOT EXISTS friends (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT      NOT NULL,
  tier        TEXT      NOT NULL CHECK (tier IN ('best', 'good', 'casual')),
  last_contact DATE     NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  id                    INTEGER PRIMARY KEY DEFAULT 1,
  email                 TEXT    NOT NULL DEFAULT '',
  smtp_host             TEXT    NOT NULL DEFAULT '',
  smtp_port             INTEGER NOT NULL DEFAULT 587,
  smtp_user             TEXT    NOT NULL DEFAULT '',
  smtp_password         TEXT    NOT NULL DEFAULT '',
  notify_time           TEXT    NOT NULL DEFAULT '08:00',
  notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_notified         DATE,
  CONSTRAINT settings_single_row CHECK (id = 1)
);

-- Seed the single settings row
INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;
