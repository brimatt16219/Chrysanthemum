// Shared utilities for event edge functions (event-checkin-claim, event-quest-submit, …).
// Each new event type only needs its own edge function — this file handles the
// common DB plumbing: loading the event row, reading/writing user progress.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EventProgress {
  claimedDays?:     number[];
  lastClaimedAt?:   string;
  completedQuests?: string[];
  claimedRewards?:  string[];
}

export interface EventRow {
  id:          string;
  type:        string;
  name:        string;
  description: string;
  starts_at:   string;
  ends_at:     string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config:      any;
  created_at:  string;
}

type SupabaseClient = ReturnType<typeof createClient>;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if the event is currently running. */
export function isEventActive(event: EventRow): boolean {
  const now = Date.now();
  return new Date(event.starts_at).getTime() <= now &&
         new Date(event.ends_at).getTime()   >  now;
}

/**
 * Fetches an event row by ID. Throws a descriptive error string if the event
 * doesn't exist or has already ended — callers can return that string as a 400.
 */
export async function loadEvent(
  supabase: SupabaseClient,
  eventId:  string,
): Promise<EventRow> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error || !data) throw "Event not found";
  if (!isEventActive(data as EventRow)) throw "Event is not currently active";

  return data as EventRow;
}

/**
 * Returns the user's current progress for an event.
 * Returns an empty object if no row exists yet (first interaction).
 */
export async function loadProgress(
  supabase: SupabaseClient,
  userId:   string,
  eventId:  string,
): Promise<EventProgress> {
  const { data } = await supabase
    .from("event_progress")
    .select("progress")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .single();

  return (data?.progress as EventProgress) ?? {};
}

/**
 * Upserts the user's progress for an event. Always call this after any
 * successful claim/submit — it handles both insert (first claim) and update.
 */
export async function saveProgress(
  supabase:  SupabaseClient,
  userId:    string,
  eventId:   string,
  progress:  EventProgress,
): Promise<void> {
  await supabase
    .from("event_progress")
    .upsert(
      { user_id: userId, event_id: eventId, progress, updated_at: new Date().toISOString() },
      { onConflict: "user_id,event_id" },
    );
}
