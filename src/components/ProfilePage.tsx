import { useEffect, useState } from "react";
import { getProfileByUsername, getPublicSave, updateDisplayFlower } from "../store/cloudSave";
import type { CloudProfile } from "../store/cloudSave";
import type { GameState } from "../store/gameStore";
import { ReadOnlyGarden } from "./ReadOnlyGarden";
import { getFlower, RARITY_CONFIG, MUTATIONS } from "../data/flowers";
import { useGame } from "../store/GameContext";
import { FriendButton } from "./FriendButton";
import { SendGiftModal } from "./SendGiftModal";


interface Props {
  username: string;
  onBack: () => void;
}

export function ProfilePage({ username, onBack }: Props) {
  const { user, profile: myProfile, state, update } = useGame();
  const [profile, setProfile]   = useState<CloudProfile | null>(null);
  const [save, setSave]         = useState<GameState | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftSent, setGiftSent]           = useState(false);

  const isOwnProfile = myProfile?.username === username;

  useEffect(() => {
    async function load() {
      setLoading(true);
      const p = await getProfileByUsername(username);
      if (!p) { setNotFound(true); setLoading(false); return; }
      setProfile(p);
      const s = isOwnProfile
        ? state   // use live state for own profile
        : await getPublicSave(p.id);
      setSave(s);
      setLoading(false);
    }
    load();
  }, [username]);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <p className="text-muted-foreground text-sm font-mono animate-pulse">Loading profile...</p>
    </div>
  );

  if (notFound || !profile) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <p className="text-4xl">🔍</p>
      <p className="font-medium text-muted-foreground">Player not found</p>
      <button onClick={onBack} className="text-xs text-primary hover:underline">
        ← Go back
      </button>
    </div>
  );

  const displayFlower = getFlower(profile.display_flower);
  const displayRarity = displayFlower ? RARITY_CONFIG[displayFlower.rarity] : null;
  const totalItems    = save?.inventory.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const uniqueSpecies = new Set(save?.inventory.map(i => i.speciesId) ?? []).size;

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
        {/* Display flower avatar */}
        <div className={`
          w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-4xl flex-shrink-0
          ${displayRarity?.glow ?? ""}
          ${displayFlower ? "border-primary/40 bg-primary/10" : "border-border bg-card"}
        `}>
          {displayFlower?.emoji.bloom ?? "🌱"}
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
              {displayFlower.emoji.bloom} {displayFlower.name} · {displayRarity?.label}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Joined {new Date(profile.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
          </p>
        </div>

        {/* Send gift button */}
        {!isOwnProfile && profile && user && (
            <div className="flex gap-2 mt-3 flex-wrap">
                <FriendButton theirId={profile.id} theirUsername={profile.username} />
                <button
                onClick={() => setShowGiftModal(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                >
                🎁 Send Gift
                </button>
            </div>
            )}

            {/* Gift sent confirmation */}
            {giftSent && (
            <div className="mt-3 flex items-center gap-2 text-xs text-green-400 font-mono">
                <span>✓</span>
                <span>Gift sent!</span>
            </div>
            )}

            {/* Gift modal */}
            {showGiftModal && profile && (
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

      {/* Stats row */}
      {save && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Coins",   value: save.coins.toLocaleString(), emoji: "🪙" },
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

      {/* Display flower picker — only on own profile */}
      {isOwnProfile && save && (
        <DisplayFlowerPicker />
      )}

      {/* Garden */}
      {save && save.grid.length > 0 && (
        <div className="bg-card/60 border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold mb-4">
            {isOwnProfile ? "Your Garden" : `${profile.username}'s Garden`}
          </h3>
          <ReadOnlyGarden grid={save.grid} farmSize={save.farmSize} />
        </div>
      )}

      {/* Inventory preview */}
      {save && save.inventory.length > 0 && (
        <div className="bg-card/60 border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold mb-4">
            {isOwnProfile ? "Your Collection" : `${profile.username}'s Collection`}
          </h3>
          <div className="flex flex-wrap gap-2">
            {save.inventory.map((item, i) => {
              const species = getFlower(item.speciesId);
              const mut     = item.mutation ? MUTATIONS[item.mutation] : null;
              const rarity  = species ? RARITY_CONFIG[species.rarity] : null;
              if (!species) return null;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1.5 ${rarity?.glow}`}
                  title={`${species.name}${mut ? ` (${mut.name})` : ""}`}
                >
                  <span className="text-base">{species.emoji.bloom}</span>
                  {mut && <span className="text-xs">{mut.emoji}</span>}
                  <span className="text-xs text-muted-foreground">×{item.quantity}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Display flower picker ──────────────────────────────────────────────────

function DisplayFlowerPicker() {
  const { user, profile, state, update } = useGame();
  const [open, setOpen]       = useState(false);
  const [saving, setSaving]   = useState(false);

//   const { updateDisplayFlower } = require("../store/cloudSave");

  const harvestedSpecies = [...new Set(
    state.inventory.map(i => i.speciesId)
  )].map(id => getFlower(id)).filter(Boolean);

  async function handlePick(speciesId: string) {
    if (!user) return;
    setSaving(true);
    await updateDisplayFlower(user.id, speciesId);
    setSaving(false);
    setOpen(false);
    // Reload profile
    window.location.reload(); // simple approach — profile will refresh
  }

  if (harvestedSpecies.length === 0) return null;

  return (
    <div className="bg-card/60 border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Display Flower</h3>
        <button
          onClick={() => setOpen(v => !v)}
          className="text-xs text-primary hover:underline"
        >
          {open ? "Cancel" : "Change"}
        </button>
      </div>

      {!open ? (
        <p className="text-xs text-muted-foreground">
          Choose a flower from your collection to display on your profile.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 mt-2">
          {harvestedSpecies.map((species) => {
            if (!species) return null;
            const rarity = RARITY_CONFIG[species.rarity];
            const isCurrent = profile?.display_flower === species.id;
            return (
              <button
                key={species.id}
                onClick={() => handlePick(species.id)}
                disabled={saving}
                className={`
                  flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all
                  ${isCurrent
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border hover:border-primary/50 bg-background"
                  }
                `}
              >
                <span className="text-lg">{species.emoji.bloom}</span>
                <div className="text-left">
                  <p className="text-xs font-medium">{species.name}</p>
                  <p className={`text-[10px] font-mono ${rarity.color}`}>{rarity.label}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}