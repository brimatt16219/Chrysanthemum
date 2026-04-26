import { useEffect, useState } from "react";
import { getProfileByUsername, getPublicSave, updateDisplayFlower, updateStatus } from "../store/cloudSave";
import type { CloudProfile } from "../store/cloudSave";
import type { GameState } from "../store/gameStore";
import { ReadOnlyGarden } from "./ReadOnlyGarden";
import { getFlower, RARITY_CONFIG, MUTATIONS, FLOWERS } from "../data/flowers";
import type { MutationType } from "../data/flowers";
import { useGame } from "../store/GameContext";
import { FriendButton } from "./FriendButton";
import { SendGiftModal } from "./SendGiftModal";
import { Codex } from "./Codex";

interface Props {
  username: string;
  onBack: () => void;
}

export function ProfilePage({ username, onBack }: Props) {
  const { user, profile: myProfile, state, refreshProfile } = useGame();

  const [profile, setProfile]             = useState<CloudProfile | null>(null);
  const [save, setSave]                   = useState<GameState | null>(null);
  const [loading, setLoading]             = useState(true);
  const [notFound, setNotFound]           = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftSent, setGiftSent]           = useState(false);

  const isOwnProfile = !!(user && profile && user.id === profile.id);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setNotFound(false);
      setProfile(null);
      setSave(null);

      const p = await getProfileByUsername(username);
      if (!p) { setNotFound(true); setLoading(false); return; }
      setProfile(p);

      const isOwn = user?.id === p.id;
      const s     = isOwn ? state : await getPublicSave(p.id);
      setSave(s);
      setLoading(false);
    }
    load();
  }, [username, user?.id]);

  // Keep local profile in sync with context after display flower change
  useEffect(() => {
    if (myProfile && profile && myProfile.id === profile.id) {
      setProfile(myProfile);
    }
  }, [myProfile]);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <p className="text-muted-foreground text-sm font-mono animate-pulse">
        Loading profile...
      </p>
    </div>
  );

  if (notFound || !profile) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <p className="text-4xl">🔍</p>
      <p className="font-medium text-muted-foreground">Player not found</p>
      <button onClick={onBack} className="text-xs text-primary hover:underline">
        ← Back
      </button>
    </div>
  );

  const displayFlower   = getFlower(profile.display_flower);
  const displayRarity   = displayFlower ? RARITY_CONFIG[displayFlower.rarity] : null;
  const totalItems      = save?.inventory.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const uniqueSpecies   = new Set(save?.inventory.map((i) => i.speciesId) ?? []).size;
  const displayMutation = save?.inventory.find(
    (i) => i.speciesId === profile.display_flower && i.mutation
  )?.mutation;
  const mutObj = displayMutation ? MUTATIONS[displayMutation as MutationType] : null;

  return (
    <div className="flex flex-col gap-6">

      {/* Back button */}
      <button
        onClick={onBack}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors self-start flex items-center gap-1"
      >
        ← Back
      </button>

      {/* Profile card */}
      <div className="bg-card/60 border border-border rounded-2xl p-5 flex items-center gap-5">
      <div className={`
        relative w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-4xl flex-shrink-0
        ${displayRarity?.glow ?? ""}
        ${displayFlower
          ? displayFlower.rarity === "common"    ? "border-gray-400/60 bg-gray-400/10"
          : displayFlower.rarity === "uncommon"  ? "border-green-400/60 bg-green-400/10"
          : displayFlower.rarity === "rare"      ? "border-blue-400/60 bg-blue-400/10"
          : displayFlower.rarity === "legendary" ? "border-yellow-400/60 bg-yellow-400/10"
          : displayFlower.rarity === "mythic"    ? "border-pink-400/60 bg-pink-400/10"
          : "border-black/60 bg-black/10"
          : "border-border bg-card"
        }
      `}>
          {displayFlower?.emoji.bloom ?? "🌱"}
          {mutObj && (
            <span className="absolute -top-1 -right-1 text-lg">{mutObj.emoji}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold truncate">{profile.username}</h2>
            {isOwnProfile && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                You
              </span>
            )}
          </div>
          {displayFlower && (
            <p className={`text-xs font-mono mt-0.5 ${displayRarity?.color}`}>
              {displayFlower.emoji.bloom} {displayFlower.name}
              {mutObj && (
                <span className={` ml-1 ${MUTATIONS[displayMutation as MutationType].color}`}>
                  · {mutObj.emoji} {mutObj.name}
                </span>
              )}
              {" · "}{displayRarity?.label}
            </p>
          )}
          {profile.status && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              "{profile.status}"
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Joined {new Date(profile.created_at).toLocaleDateString(undefined, {
              month: "short", year: "numeric",
            })}
          </p>
        </div>
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
            { label: "Coins",   value: save.coins.toLocaleString(), emoji: "🟡" },
            { label: "Items",   value: totalItems.toString(),       emoji: "🎒" },
            { label: "Species", value: uniqueSpecies.toString(),    emoji: "🌸" },
          ].map(({ label, value, emoji }) => (
            <div key={label} className="bg-card/60 border border-border rounded-xl px-3 py-3 text-center">
              <p className="text-xl">{emoji}</p>
              <p className="text-base font-bold mt-1">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Display flower picker — own profile only */}
      {isOwnProfile && (
        <DisplayFlowerPicker
          discovered={save?.discovered ?? state.discovered}
          currentFlower={profile.display_flower}
          onUpdated={refreshProfile}
        />
      )}

      {/* Status editor — own profile only */}
      {isOwnProfile && (
        <StatusEditor
          currentStatus={profile.status ?? ""}
          onUpdated={refreshProfile}
        />
      )}

      {/* Garden */}
      {save && save.grid.length > 0 && (
        <div className="bg-card/60 border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold mb-4">Your Garden</h3>
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
                  <span className="text-base">{species.emoji.bloom}</span>
                  {mut && <span className="absolute -top-1 -right-1 text-xs">{mut.emoji}</span>}
                  <span className="text-xs text-muted-foreground">×{item.quantity}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Codex preview */}
      {save && (
        <Codex
          compact
          discoveredOverride={save.discovered ?? []}
        />
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

// ── Status editor ─────────────────────────────────────────────────────────

interface StatusEditorProps {
  currentStatus: string;
  onUpdated: () => Promise<void>;
}

function StatusEditor({ currentStatus, onUpdated }: StatusEditorProps) {
  const { user } = useGame();
  const [editing, setEditing] = useState(false);
  const [value, setValue]     = useState(currentStatus);
  const [saving, setSaving]   = useState(false);

  const MAX = 80;

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    await updateStatus(user.id, value);
    await onUpdated();
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="bg-card/60 border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Status</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            A short message shown on your profile
          </p>
        </div>
        <button
          onClick={() => { setEditing((v) => !v); setValue(currentStatus); }}
          className="text-xs text-primary hover:underline flex-shrink-0"
        >
          {editing ? "Cancel" : currentStatus ? "Edit" : "Add"}
        </button>
      </div>

      {!editing ? (
        currentStatus ? (
          <p className="text-sm text-muted-foreground italic">"{currentStatus}"</p>
        ) : (
          <p className="text-xs text-muted-foreground">No status set.</p>
        )
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, MAX))}
            placeholder="What's on your mind?"
            rows={2}
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary transition-colors"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-mono">
              {value.length}/{MAX}
            </span>
            <button
              onClick={handleSave}
              disabled={saving || value === currentStatus}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Display flower picker ─────────────────────────────────────────────────

interface PickerProps {
  discovered: string[];   // codex discovered array from game state
  currentFlower: string;
  onUpdated: () => Promise<void>;
}

function DisplayFlowerPicker({ discovered, currentFlower, onUpdated }: PickerProps) {
  const { user } = useGame();
  const [open, setOpen]     = useState(false);
  const [saving, setSaving] = useState(false);

  // Any species the player has discovered (base entry = "speciesId" in discovered)
  const unlockedFlowers = FLOWERS.filter((f) => discovered.includes(f.id));

  async function handlePick(speciesId: string) {
    if (!user) return;
    setSaving(true);
    await updateDisplayFlower(user.id, speciesId);
    await onUpdated();
    setSaving(false);
    setOpen(false);
  }

  return (
    <div className="bg-card/60 border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Display Flower</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {unlockedFlowers.length > 0
              ? `${unlockedFlowers.length} flower${unlockedFlowers.length !== 1 ? "s" : ""} unlocked`
              : "Harvest flowers to unlock display options"
            }
          </p>
        </div>
        {unlockedFlowers.length > 0 && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-primary hover:underline flex-shrink-0"
          >
            {open ? "Cancel" : "Change"}
          </button>
        )}
      </div>

      {unlockedFlowers.length === 0 ? (
        <div className="flex items-center gap-3 py-2">
          <span className="text-2xl">🌱</span>
          <p className="text-xs text-muted-foreground">
            Harvest your first flower to unlock display options.
          </p>
        </div>
      ) : !open ? null : (
        <div className="flex flex-col gap-1.5 mt-2 max-h-72 overflow-y-auto">
          {unlockedFlowers.map((flower) => {
            const rarity    = RARITY_CONFIG[flower.rarity];
            const isCurrent = currentFlower === flower.id;

            return (
              <button
                key={flower.id}
                onClick={() => handlePick(flower.id)}
                disabled={saving}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left
                  ${isCurrent
                    ? "border-primary bg-primary/20"
                    : "border-border hover:border-primary/50 bg-background"
                  }
                `}
              >
                <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl leading-none">{flower.emoji.bloom}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{flower.name}</p>
                  <p className={`text-xs font-mono ${rarity.color}`}>{rarity.label}</p>
                </div>
                {isCurrent && (
                  <span className="text-xs text-primary font-mono flex-shrink-0">current</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
