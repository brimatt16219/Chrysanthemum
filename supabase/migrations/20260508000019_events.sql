-- ── events ────────────────────────────────────────────────────────────────────
-- One row per event instance. Rows are inserted manually via Supabase Studio —
-- no admin UI needed. type is an open string ("checkin", "collection", etc.)
-- so new event types never require a schema change.

CREATE TABLE IF NOT EXISTS events (
  id          TEXT        PRIMARY KEY,
  type        TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  config      JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── event_progress ────────────────────────────────────────────────────────────
-- One row per (user, event). Progress shape varies by event type:
--   checkin:    { claimedDays: number[], lastClaimedAt: string }
--   collection: { completedQuests: string[], claimedRewards: string[] }

CREATE TABLE IF NOT EXISTS event_progress (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id   TEXT        NOT NULL REFERENCES events(id)     ON DELETE CASCADE,
  progress   JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_progress ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read events (needed to render the Events tab)
CREATE POLICY "events_select" ON events
  FOR SELECT TO authenticated USING (true);

-- Users can only read and write their own progress rows
CREATE POLICY "event_progress_select" ON event_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "event_progress_insert" ON event_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "event_progress_update" ON event_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
