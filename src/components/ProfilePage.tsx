import { useEffect, useState } from "react";
import { getProfileByUsername, getPublicSave, updateDisplayFlower, updateStatus, updateUsername } from "../store/cloudSave";
import type { CloudProfile } from "../store/cloudSave";
import { simulateOfflineGarden } from "../store/gameStore";
import { supabase } from "../lib/supabase";
import type { GameState } from "../store/gameStore";
import { ReadOnlyGarden } from "./ReadOnlyGarden";
import { getFlower, RARITY_CONFIG, MUTATIONS, FLOWERS } from "../data/flowers";
import type { MutationType } from "../data/flowers";
import { getPresenceStatus, formatLastSeen, STATUS_DOT, STATUS_TEXT_COLOR } from "../lib/presence";
import { useGame } from "../store/GameContext";
import { FriendButton } from "./FriendButton";
import { SendGiftModal } from "./SendGiftModal";
import { Codex } from "./Codex";
import { ItemSprite } from "./ItemSprite";
import { FlowerSprite } from "./FlowerSprite";

interface Props {
  username: string;
}

const USERNAME_MAX = 20;
const STATUS_MAX   = 80;

export function ProfilePage({ username }: Props) {
  const { user, profile: myProfile, state, refreshProfile } = useGame();

  const [profile, setProfile]             = useState<CloudProfile | null>(null);
  const [save, setSave]                   = useState<GameState | null>(null);
  const [loading, setLoading]             = useState(true);
  const [notFound, setNotFound]           = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftSent, setGiftSent]           = useState(false);

  // ── Flower picker ────────────────────────────────────────────────────────
  const [flowerOpen,     setFlowerOpen]     = useState(false);
  const [pendingSpecies, setPendingSpecies] = useState<string | null>(null);
  const [savingFlower,   setSavingFlower]   = useState(false);

  // ── Username editor ──────────────────────────────────────────────────────
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameValue,   setUsernameValue]   = useState("");
  const [usernameError,   setUsernameError]   = useState<string | null>(null);
  const [savingUsername,  setSavingUsername]  = useState(false);

  // ── Status editor ────────────────────────────────────────────────────────
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusValue,   setStatusValue]   = useState("");
  const [savingStatus,  setSavingStatus]  = useState(false);

  const isOwnProfile = !!(user && profile && user.id === profile.id);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setNotFound(false);
      setProfile(null);
      setSave(null);
      setFlowerOpen(false);
      setEditingUsername(false);
      setEditingStatus(false);

      const p = await getProfileByUsername(username);
      if (!p) { setNotFound(true); setLoading(false); return; }
      setProfile(p);

      const isOwn = user?.id === p.id;
      const raw   = isOwn ? state : await getPublicSave(p.id);
      // Apply offline simulation for other players' gardens so gear auto-actions
      // (harvest bell, auto-planter) are reflected even when the owner is offline.
      const s = raw && !isOwn ? simulateOfflineGarden(raw) : raw;
      setSave(s);
      setLoading(false);
    }
    load();
  }, [username, user?.id]);

  useEffect(() => {
    if (myProfile && profile && myProfile.id === profile.id) {
      setProfile(myProfile);
    }
  }, [myProfile]);

  // ── Periodic re-simulation: keep the garden display live ─────────────────
  // simulateOfflineGarden uses Date.now(), so re-running it on the cached save
  // advances plant growth and applies gear effects (harvest bell, auto-planter)
  // without a DB fetch. This fills the gap between 30-second cron ticks.
  useEffect(() => {
    if (!save) return;
    const interval = setInterval(() => {
      setSave((prev) => (prev ? simulateOfflineGarden(prev) : prev));
    }, 5_000);
    return () => clearInterval(interval);
  }, [!!save]); // only restart when save goes from null → populated

  // ── Realtime: refresh the garden when the viewed user saves ───────────────
  // Subscribes for ALL profiles (own and others) so the garden view updates
  // whenever the DB changes — whether from the user's own edge-function actions,
  // another device, or the offline cron tick.
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel(`profile-garden:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "game_saves",
          filter: `user_id=eq.${profile.id}`,
        },
        async () => {
          const fresh = await getPublicSave(profile.id);
          if (fresh) setSave(simulateOfflineGarden(fresh));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, user?.id]);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <p className="text-muted-foreground text-sm font-mono animate-pulse">Loading profile...</p>
    </div>
  );

  if (notFound || !profile) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <p className="text-4xl">🔍</p>
      <p className="font-medium text-muted-foreground">Player not found</p>
    </div>
  );

  // ── Derived display values ───────────────────────────────────────────────
  const displayFlower   = getFlower(profile.display_flower);
  const displayRarity   = displayFlower ? RARITY_CONFIG[displayFlower.rarity] : null;
  const presenceStatus  = !isOwnProfile ? getPresenceStatus(profile.last_seen_at) : null;
  const totalItems      = save?.inventory.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const uniqueSpecies   = new Set(save?.inventory.map((i) => i.speciesId) ?? []).size;
  const displayMutation = profile.display_mutation as MutationType | null;
  const mutObj          = displayMutation ? MUTATIONS[displayMutation] : null;

  // ── Flower picker data ───────────────────────────────────────────────────
  const discovered        = save?.discovered ?? state.discovered;
  const unlockedFlowers   = FLOWERS.filter((f) => discovered.includes(f.id));
  const activeSpecies     = pendingSpecies ?? profile.display_flower;
  const unlockedMutations = Object.values(MUTATIONS).filter((m) =>
    discovered.includes(`${activeSpecies}:${m.id}`)
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handlePickFlower(speciesId: string, mutation: string | null) {
    if (!user) return;
    setSavingFlower(true);
    await updateDisplayFlower(user.id, speciesId, mutation);
    await refreshProfile();
    setSavingFlower(false);
    setPendingSpecies(null);
    setFlowerOpen(false);
  }

  async function handleSaveUsername() {
    if (!user) return;
    setSavingUsername(true);
    setUsernameError(null);
    const result = await updateUsername(user.id, usernameValue.trim());
    if (!result.ok) {
      setUsernameError(result.error ?? "Something went wrong");
      setSavingUsername(false);
      return;
    }
    await refreshProfile();
    setSavingUsername(false);
    setEditingUsername(false);
  }

  async function handleSaveStatus() {
    if (!user) return;
    setSavingStatus(true);
    await updateStatus(user.id, statusValue);
    await refreshProfile();
    setSavingStatus(false);
    setEditingStatus(false);
  }

  // Avatar border classes shared between button and div
  const avatarBorderClass = displayFlower
    ? displayFlower.rarity === "common"    ? "border-gray-400/60 bg-gray-400/10"
    : displayFlower.rarity === "uncommon"  ? "border-green-400/60 bg-green-400/10"
    : displayFlower.rarity === "rare"      ? "border-blue-400/60 bg-blue-400/10"
    : displayFlower.rarity === "legendary" ? "border-yellow-400/60 bg-yellow-400/10"
    : displayFlower.rarity === "mythic"    ? "border-pink-400/60 bg-pink-400/10"
    : "border-black/60 bg-black/10"
    : "border-border bg-card";

  return (
    <div className="flex flex-col gap-6">

      {/* ── Profile card ─────────────────────────────────────────────────── */}
      <div className="bg-card/60 border border-border rounded-2xl p-5">
        <div className="flex items-start gap-5">

          {/* Avatar — clickable on own profile */}
          {isOwnProfile ? (
            <button
              onClick={() => { setFlowerOpen((v) => !v); setPendingSpecies(null); }}
              title="Change display flower"
              className={`
                relative w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-4xl
                flex-shrink-0 transition-all hover:brightness-110
                ${displayRarity?.glow ?? ""} ${avatarBorderClass}
                ${flowerOpen ? "ring-2 ring-primary/50" : ""}
              `}
            >
              {displayFlower ? <FlowerSprite species={displayFlower} stage="bloom" imgSize="w-10 h-10" textSize="text-4xl" className={mutObj?.vfxClass ?? ""} /> : "🌱"}
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center text-[10px] text-muted-foreground">
                ✎
              </span>
            </button>
          ) : (
            <div className={`
              relative w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-4xl flex-shrink-0
              ${displayRarity?.glow ?? ""} ${avatarBorderClass}
            `}>
              {displayFlower ? <FlowerSprite species={displayFlower} stage="bloom" imgSize="w-10 h-10" textSize="text-4xl" className={mutObj?.vfxClass ?? ""} /> : "🌱"}
              {presenceStatus && (
                <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background ${STATUS_DOT[presenceStatus]}`} />
              )}
            </div>
          )}

          {/* Info column */}
          <div className="flex-1 min-w-0 space-y-1">

            {/* Username row */}
            {isOwnProfile && editingUsername ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={usernameValue}
                    onChange={(e) => { setUsernameValue(e.target.value.slice(0, USERNAME_MAX)); setUsernameError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveUsername(); if (e.key === "Escape") setEditingUsername(false); }}
                    className="flex-1 min-w-0 bg-background border border-border rounded-lg px-2 py-1 text-sm font-mono focus:outline-none focus:border-primary transition-colors"
                  />
                  <button
                    onClick={handleSaveUsername}
                    disabled={savingUsername || usernameValue.trim() === profile.username}
                    className="text-xs px-2 py-1 rounded-lg bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30 transition-colors disabled:opacity-40"
                  >
                    {savingUsername ? "…" : "Save"}
                  </button>
                  <button
                    onClick={() => { setEditingUsername(false); setUsernameError(null); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-mono">{usernameValue.trim().length}/{USERNAME_MAX}</span>
                  {usernameError && <span className="text-[10px] text-red-400">{usernameError}</span>}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold truncate">{profile.username}</h2>
                {isOwnProfile && (
                  <>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                      You
                    </span>
                    <button
                      onClick={() => { setUsernameValue(profile.username); setEditingUsername(true); }}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit username"
                    >
                      ✎
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Presence status line */}
            {presenceStatus && (
              <p className={`text-xs font-mono ${STATUS_TEXT_COLOR[presenceStatus]}`}>
                {presenceStatus === "offline"
                  ? `Last seen ${formatLastSeen(profile.last_seen_at)}`
                  : presenceStatus === "away" ? "Away"
                  : "Online"}
              </p>
            )}

            {/* Display flower line */}
            {displayFlower && (
              <p className={`text-xs font-mono ${displayRarity?.color} flex items-center gap-1 flex-wrap`}>
                <FlowerSprite species={displayFlower} stage="bloom" imgSize="w-3.5 h-3.5" textSize="text-xs" />
                {displayFlower.name}
                {mutObj && (
                  <span className={`ml-1 inline-flex items-center gap-0.5 ${MUTATIONS[displayMutation as MutationType].color}`}>
                    · <ItemSprite emoji={mutObj.emoji} sprite={mutObj.sprite} name={mutObj.emoji} textSize="text-xs" imgSize="w-3.5 h-3.5" /> {mutObj.name}
                  </span>
                )}
                {" · "}{displayRarity?.label}
              </p>
            )}

            {/* Status row */}
            {isOwnProfile && editingStatus ? (
              <div className="space-y-1 pt-0.5">
                <textarea
                  autoFocus
                  value={statusValue}
                  onChange={(e) => setStatusValue(e.target.value.slice(0, STATUS_MAX))}
                  rows={2}
                  placeholder="What's on your mind?"
                  className="w-full bg-background border border-border rounded-lg px-2 py-1 text-xs resize-none focus:outline-none focus:border-primary transition-colors"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-mono">{statusValue.length}/{STATUS_MAX}</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setEditingStatus(false)}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveStatus}
                      disabled={savingStatus || statusValue === (profile.status ?? "")}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30 transition-colors disabled:opacity-40"
                    >
                      {savingStatus ? "…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                {profile.status ? (
                  <p className="text-xs text-muted-foreground italic">"{profile.status}"</p>
                ) : isOwnProfile ? (
                  <p className="text-xs text-muted-foreground">No status set</p>
                ) : null}
                {isOwnProfile && (
                  <button
                    onClick={() => { setStatusValue(profile.status ?? ""); setEditingStatus(true); }}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    title="Edit status"
                  >
                    {profile.status ? "✎" : "+ Add"}
                  </button>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Joined {new Date(profile.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* ── Flower picker — expands inline ───────────────────────────── */}
        {isOwnProfile && flowerOpen && (
          <div className="mt-4 pt-4 border-t border-border">
            {unlockedFlowers.length === 0 ? (
              <div className="flex items-center gap-3 py-2">
                <span className="text-2xl">🌱</span>
                <p className="text-xs text-muted-foreground">Harvest your first flower to unlock display options.</p>
              </div>
            ) : pendingSpecies ? (
              /* Step 2: pick a mutation */
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <button
                    onClick={() => setPendingSpecies(null)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← Back
                  </button>
                  <p className="text-xs text-muted-foreground">
                    Choose a mutation for{" "}
                    <span className="text-foreground font-medium">{getFlower(pendingSpecies)?.name}</span>
                  </p>
                </div>

                {/* No mutation */}
                <button
                  onClick={() => handlePickFlower(pendingSpecies, null)}
                  disabled={savingFlower}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border transition-all text-left
                    ${pendingSpecies === profile.display_flower && !profile.display_mutation
                      ? "border-primary bg-primary/20"
                      : "border-border hover:border-primary/50 bg-background"
                    }`}
                >
                  <span className="w-9 flex items-center justify-center flex-shrink-0">
                    {(() => { const pf = getFlower(pendingSpecies!); return pf ? <FlowerSprite species={pf} stage="bloom" imgSize="w-8 h-8" textSize="text-2xl" /> : null; })()}
                  </span>
                  <div>
                    <p className="text-sm font-medium">No mutation</p>
                    <p className="text-xs text-muted-foreground font-mono">Base bloom</p>
                  </div>
                </button>

                {unlockedMutations.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1 pt-1">No mutations discovered for this flower yet.</p>
                ) : unlockedMutations.map((mut) => (
                  <button
                    key={mut.id}
                    onClick={() => handlePickFlower(pendingSpecies, mut.id)}
                    disabled={savingFlower}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border transition-all text-left
                      ${pendingSpecies === profile.display_flower && mut.id === profile.display_mutation
                        ? "border-primary bg-primary/20"
                        : "border-border hover:border-primary/50 bg-background"
                      }`}
                  >
                    <div className="w-9 flex items-center justify-center flex-shrink-0">
                      {(() => { const pf = getFlower(pendingSpecies!); return pf ? <FlowerSprite species={pf} stage="bloom" imgSize="w-8 h-8" textSize="text-2xl" className={mut.vfxClass} /> : null; })()}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${mut.color}`}>{mut.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">×{mut.valueMultiplier} value</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              /* Step 1: pick a species */
              <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                {unlockedFlowers.map((flower) => {
                  const rarity    = RARITY_CONFIG[flower.rarity];
                  const isCurrent = profile.display_flower === flower.id;
                  return (
                    <button
                      key={flower.id}
                      onClick={() => setPendingSpecies(flower.id)}
                      disabled={savingFlower}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left
                        ${isCurrent ? "border-primary bg-primary/20" : "border-border hover:border-primary/50 bg-background"}`}
                    >
                      <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
                        <FlowerSprite species={flower} stage="bloom" imgSize="w-8 h-8" textSize="text-2xl" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{flower.name}</p>
                        <p className={`text-xs font-mono ${rarity.color}`}>{rarity.label}</p>
                      </div>
                      {isCurrent && <span className="text-xs text-primary font-mono flex-shrink-0">current</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Friend + gift buttons — other players only */}
      {!isOwnProfile && user && (
        <div className="flex gap-2 flex-wrap">
          <FriendButton theirId={profile.id} theirUsername={profile.username} />
          <button
            onClick={() => setShowGiftModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
          >
            🎁 Send Gift
          </button>
        </div>
      )}

      {giftSent && (
        <div className="flex items-center gap-2 text-xs text-green-400 font-mono">
          <span>✓</span><span>Gift sent!</span>
        </div>
      )}

      {/* Stats */}
      {save && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Coins",   value: save.coins.toLocaleString(), emoji: "🟡", sprite: "/sprites/ui/coins.png"      },
            { label: "Items",   value: totalItems.toString(),       emoji: "🎒", sprite: "/sprites/ui/tab_inventory.png" },
            { label: "Species", value: uniqueSpecies.toString(),    emoji: "🌸", sprite: "/sprites/flowers/bloom.png" },
          ].map(({ label, value, emoji, sprite }) => (
            <div key={label} className="bg-card/60 border border-border rounded-xl px-3 py-3 text-center">
              <p className="flex justify-center text-xl">
                <ItemSprite emoji={emoji} sprite={sprite} textSize="text-xl" imgSize="w-6 h-6" name={label} />
              </p>
              <p className="text-base font-bold mt-1">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Garden */}
      {save && save.grid.length > 0 && (
        <div className="bg-card/60 border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold mb-4">
            {isOwnProfile ? "Your Garden" : `${profile.username}'s Garden`}
          </h3>
          <ReadOnlyGarden grid={save.grid} farmSize={save.farmSize} farmRows={save.farmRows} />
        </div>
      )}

      {/* Collection — blooms only */}
      {save && save.inventory.filter(i => !i.isSeed).length > 0 && (
        <div className="bg-card/60 border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold mb-4">
            {isOwnProfile ? "Your Collection" : `${profile.username}'s Collection`}
          </h3>
          <div className="flex flex-wrap gap-2">
            {save.inventory.filter(i => !i.isSeed).map((item, i) => {
              const species = getFlower(item.speciesId);
              const mut     = item.mutation ? MUTATIONS[item.mutation as MutationType] : null;
              const rarity  = species ? RARITY_CONFIG[species.rarity] : null;
              if (!species) return null;
              return (
                <div
                  key={i}
                  className={`relative flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1.5 ${rarity?.glow}`}
                  title={`${species.name}${mut ? ` (${mut.name})` : ""}`}
                >
                  <FlowerSprite species={species} stage="bloom" imgSize="w-5 h-5" textSize="text-base" className={mut ? mut.vfxClass : ""} />
                  <span className="text-xs text-muted-foreground">×{item.quantity}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Codex preview */}
      {save && (
        <Codex compact discoveredOverride={save.discovered ?? []} />
      )}

      {/* Gift modal */}
      {showGiftModal && (
        <SendGiftModal
          receiverId={profile.id}
          receiverUsername={profile.username}
          onClose={() => setShowGiftModal(false)}
          onSent={() => {
            setShowGiftModal(false);
            setGiftSent(true);
            setTimeout(() => setGiftSent(false), 3_000);
          }}
        />
      )}
    </div>
  );
}

