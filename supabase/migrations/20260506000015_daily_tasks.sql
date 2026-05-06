-- Add daily_tasks column to game_saves
-- Stores the player's current daily task state (resets each UTC day)
ALTER TABLE game_saves
    ADD COLUMN IF NOT EXISTS daily_tasks JSONB NOT NULL DEFAULT '{}';