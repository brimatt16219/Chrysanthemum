ALTER TABLE game_saves
  ADD COLUMN IF NOT EXISTS achievement_stats    JSONB    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS achievements_claimed TEXT[]   NOT NULL DEFAULT '{}';
