import { supabase } from "../lib/supabase";
import type { GameState } from "./gameStore";

export interface CloudProfile {
  id: string;
  username: string;
  display_flower: string;
  created_at: string;
}

// ── Profile ────────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<CloudProfile | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data as CloudProfile;
}

export async function createProfile(
  userId: string,
  username: string
): Promise<CloudProfile | null> {
  const { data, error } = await supabase
    .from("users")
    .insert({ id: userId, username, display_flower: "daisy" })
    .select()
    .single();

  if (error) {
    console.error("createProfile error code:", error.code);
    console.error("createProfile error message:", error.message);
    console.error("createProfile error details:", error.details);
    return null;
  }

  return data as CloudProfile;
}

export async function updateDisplayFlower(
  userId: string,
  speciesId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("users")
    .update({ display_flower: speciesId })
    .eq("id", userId);
  return !error;
}

// ── Game save ──────────────────────────────────────────────────────────────

export async function loadCloudSave(userId: string): Promise<GameState | null> {
  const { data, error } = await supabase
    .from("game_saves")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  // Map DB columns back to GameState shape
  return {
    coins:          data.coins,
    farmSize:       data.farm_size,
    grid:           data.grid,
    inventory:      data.inventory,
    fertilizers:    data.fertilizers,
    shop:           data.shop,
    lastShopReset:  data.last_shop_reset,
    lastSaved:      data.last_saved,
  } as GameState;
}

export async function saveToCloud(
  userId: string,
  state: GameState
): Promise<boolean> {
  const { error } = await supabase
    .from("game_saves")
    .upsert({
      user_id:         userId,
      coins:           state.coins,
      farm_size:       state.farmSize,
      grid:            state.grid,
      inventory:       state.inventory,
      fertilizers:     state.fertilizers,
      shop:            state.shop,
      last_shop_reset: state.lastShopReset,
      last_saved:      Date.now(),
      updated_at:      new Date().toISOString(),
    });

  if (error) {
    console.error("Failed to save to cloud:", error);
    return false;
  }
  return true;
}

// Search users by username (partial match)
export async function searchUsers(query: string): Promise<CloudProfile[]> {
  if (!query.trim()) return [];

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .ilike("username", `%${query.trim()}%`)
    .limit(20);

  if (error || !data) return [];
  return data as CloudProfile[];
}

// Get a public profile by username
export async function getProfileByUsername(
  username: string
): Promise<CloudProfile | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .single();

  if (error || !data) return null;
  return data as CloudProfile;
}

// Get a public game save by user ID (for garden viewer)
export async function getPublicSave(userId: string): Promise<GameState | null> {
  const { data, error } = await supabase
    .from("game_saves")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return {
    coins:         data.coins,
    farmSize:      data.farm_size,
    grid:          data.grid,
    inventory:     data.inventory,
    fertilizers:   data.fertilizers,
    shop:          data.shop,
    lastShopReset: data.last_shop_reset,
    lastSaved:     data.last_saved,
  } as GameState;
}