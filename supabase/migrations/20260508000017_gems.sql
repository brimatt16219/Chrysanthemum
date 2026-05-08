-- Add gems currency column to game_saves
-- Earn-only in v2.4.0; spending mechanics deferred to v2.5.0+
ALTER TABLE game_saves
  ADD COLUMN IF NOT EXISTS gems INTEGER NOT NULL DEFAULT 0;
