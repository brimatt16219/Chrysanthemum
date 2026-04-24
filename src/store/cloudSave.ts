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
  try {
    const result = await Promise.race([
      supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("getProfile timeout")), 5_000)
      ),
    ]) as { data: CloudProfile | null; error: unknown };

    if (result.error || !result.data) return null;
    return result.data as CloudProfile;
  } catch (e) {
    // console.warn("[getProfile] failed:", e);
    return null;
  }
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
    // console.error("createProfile error code:", error.code);
    // console.error("createProfile error message:", error.message);
    // console.error("createProfile error details:", error.details);
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
  try {
    const result = await Promise.race([
      supabase
        .from("game_saves")
        .select("*")
        .eq("user_id", userId)
        .single(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("loadCloudSave timeout")), 5_000)
      ),
    ]) as { data: Record<string, unknown> | null; error: unknown };

    if (result.error || !result.data) return null;
    const data = result.data;
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
  } catch (e) {
    // console.warn("[loadCloudSave] failed:", e);
    return null;
  }
}

export async function saveToCloud(
  userId: string,
  state: GameState
): Promise<boolean> {
  // Check current cloud save timestamp before writing
  const { data: current } = await supabase
    .from("game_saves")
    .select("last_saved")
    .eq("user_id", userId)
    .single();

  // If cloud is newer than what we're writing, skip the write
  // This prevents an older session from overwriting a newer one
  if (current?.last_saved && current.last_saved > state.lastSaved) {
    // console.warn("[saveToCloud] skipping — cloud is newer", current.last_saved, "vs", state.lastSaved);
    return false;
  }

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
    // console.error("Failed to save to cloud:", error);
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

export type FriendshipStatus = "none" | "pending_sent" | "pending_received" | "accepted";

export interface Friendship {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: "pending" | "accepted";
  created_at: string;
}

export interface FriendWithProfile {
  friendship: Friendship;
  profile: CloudProfile;
}

// Get friendship status between two users
export async function getFriendshipStatus(
  myId: string,
  theirId: string
): Promise<{ status: FriendshipStatus; friendshipId: string | null }> {
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .or(
      `and(requester_id.eq.${myId},receiver_id.eq.${theirId}),` +
      `and(requester_id.eq.${theirId},receiver_id.eq.${myId})`
    )
    .maybeSingle();

  if (error || !data) return { status: "none", friendshipId: null };

  if (data.status === "accepted") return { status: "accepted", friendshipId: data.id };
  if (data.requester_id === myId)  return { status: "pending_sent", friendshipId: data.id };
  return { status: "pending_received", friendshipId: data.id };
}

// Send a friend request
export async function sendFriendRequest(
  myId: string,
  theirId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: myId, receiver_id: theirId });
  return !error;
}

// Accept a friend request
export async function acceptFriendRequest(friendshipId: string): Promise<boolean> {
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", friendshipId);
  return !error;
}

// Decline or cancel a friend request / unfriend
export async function removeFriendship(friendshipId: string): Promise<boolean> {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId);
  return !error;
}

// Get all friends and pending requests for a user
export async function getFriends(userId: string): Promise<{
  friends: FriendWithProfile[];
  pendingReceived: FriendWithProfile[];
  pendingSent: FriendWithProfile[];
}> {
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);

  if (error || !data) return { friends: [], pendingReceived: [], pendingSent: [] };

  // Fetch all profiles in parallel instead of sequentially
  const otherIds = (data as Friendship[]).map((f) =>
    f.requester_id === userId ? f.receiver_id : f.requester_id
  );

  const profiles = await Promise.all(otherIds.map((id) => getProfile(id)));

  const friends: FriendWithProfile[]         = [];
  const pendingReceived: FriendWithProfile[] = [];
  const pendingSent: FriendWithProfile[]     = [];

  for (let i = 0; i < (data as Friendship[]).length; i++) {
    const f       = (data as Friendship[])[i];
    const profile = profiles[i];
    if (!profile) continue;

    const entry: FriendWithProfile = { friendship: f, profile };

    if (f.status === "accepted") {
      friends.push(entry);
    } else if (f.requester_id === userId) {
      pendingSent.push(entry);
    } else {
      pendingReceived.push(entry);
    }
  }

  return { friends, pendingReceived, pendingSent };
}

// Count pending received requests (for notification badge)
export async function getPendingRequestCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("friendships")
    .select("*", { count: "exact", head: true })
    .eq("receiver_id", userId)
    .eq("status", "pending");

  return error ? 0 : (count ?? 0);
}

export interface Gift {
  id: string;
  sender_id: string;
  receiver_id: string;
  species_id: string;
  mutation?: string;
  message?: string;
  claimed: boolean;
  created_at: string;
}

export interface GiftWithSender {
  gift: Gift;
  senderProfile: CloudProfile;
}

// Send a gift — removes from sender inventory, inserts gift row
export async function sendGift(
  senderId: string,
  receiverId: string,
  speciesId: string,
  mutation: string | undefined,
  message: string | undefined
): Promise<boolean> {
  const { error } = await supabase
    .from("gifts")
    .insert({
      sender_id:   senderId,
      receiver_id: receiverId,
      species_id:  speciesId,
      mutation:    mutation ?? null,
      message:     message  ?? null,
    });

  if (error) {
    // console.error("sendGift error:", error);
    return false;
  }
  return true;
}

// Get unclaimed gifts for a user
export async function getPendingGifts(userId: string): Promise<GiftWithSender[]> {
  const { data, error } = await supabase
    .from("gifts")
    .select("*")
    .eq("receiver_id", userId)
    .eq("claimed", false)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  // Fetch all sender profiles in parallel
  const senderProfiles = await Promise.all(
    (data as Gift[]).map((gift) => getProfile(gift.sender_id))
  );

  const result: GiftWithSender[] = [];
  for (let i = 0; i < (data as Gift[]).length; i++) {
    const senderProfile = senderProfiles[i];
    if (senderProfile) {
      result.push({ gift: (data as Gift[])[i], senderProfile });
    }
  }

  return result;
}

// Count unclaimed gifts
export async function getPendingGiftCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("gifts")
    .select("*", { count: "exact", head: true })
    .eq("receiver_id", userId)
    .eq("claimed", false);

  return error ? 0 : (count ?? 0);
}

// Mark a gift as claimed
export async function claimGift(giftId: string): Promise<boolean> {
  const { error } = await supabase
    .from("gifts")
    .update({ claimed: true })
    .eq("id", giftId);

  return !error;
}

// Get sent gift history
export async function getSentGifts(userId: string): Promise<Gift[]> {
  const { data, error } = await supabase
    .from("gifts")
    .select("*")
    .eq("sender_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return error || !data ? [] : (data as Gift[]);
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  display_flower: string;
  coins: number;
  farm_size: number;
  updated_at: string;
  rank: number;
}

// Global top 50
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .order("rank", { ascending: true })
    .limit(50);

  if (error || !data) {
    // console.error("getLeaderboard error:", error);
    return [];
  }
  return data as LeaderboardEntry[];
}

// Friends leaderboard — your rank among friends
export async function getFriendsLeaderboard(
  userId: string
): Promise<LeaderboardEntry[]> {
  // Get friend IDs
  const { data: friendships, error: fError } = await supabase
    .from("friendships")
    .select("requester_id, receiver_id")
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq("status", "accepted");

  if (fError || !friendships) return [];

  const friendIds = friendships.map((f) =>
    f.requester_id === userId ? f.receiver_id : f.requester_id
  );

  // Include yourself
  const allIds = [...friendIds, userId];

  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .in("id", allIds)
    .order("coins", { ascending: false });

  if (error || !data) return [];

  // Re-rank within this group
  return (data as LeaderboardEntry[]).map((entry, i) => ({
    ...entry,
    rank: i + 1,
  }));
}

// Get a single user's global rank
export async function getMyRank(userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("rank")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data.rank;
}