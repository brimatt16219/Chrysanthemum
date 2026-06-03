import { useEffect, useState, useCallback, useRef } from "react";
import { useGame } from "../store/GameContext";
import { audioManager } from "../lib/audioManager";
import { getFlower, RARITY_CONFIG, MUTATIONS } from "../data/flowers";
import type { MutationType } from "../data/flowers";
import { FERTILIZERS } from "../data/upgrades";
import type { FertilizerType } from "../data/upgrades";
import { GEAR as GEAR_CATALOG } from "../data/gear";
import type { GearType } from "../data/gear";
import { getAllMail, clearClaimedMail } from "../store/cloudSave";
import type { MailboxEntry } from "../store/cloudSave";
import { edgeClaimMail } from "../lib/edgeFunctions";
import { supabase } from "../lib/supabase";
import { ItemSprite } from "./ItemSprite";
import { FlowerSprite } from "./FlowerSprite";

interface Props {
  onViewProfile:  (username: string) => void;
  onCountChange?: (total: number) => void;
}

function formatCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  if (ms < 60_000)           return "just now";
  if (ms < 60 * 60_000)      return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 24 * 60 * 60_000) return `${Math.floor(ms / (60 * 60_000))}h ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MailboxPage({ onViewProfile, onCountChange }: Props) {
  const { user, state, update } = useGame();

  const [mail,        setMail]        = useState<MailboxEntry[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [claiming,    setClaiming]    = useState<string | null>(null);
  const [claimingAll, setClaimingAll] = useState(false);
  const [claimedIds,  setClaimedIds]  = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [openId,      setOpenId]      = useState<string | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const m = await getAllMail(user.id);
      setMail(m);
      onCountChange?.(m.length);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user, onCountChange]);

  useEffect(() => { load(); }, [load]);

  // Realtime: reload full list whenever a new mail arrives for this user
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("mailbox-page")
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "mailbox",
          filter: `user_id=eq.${user.id}`,
        },
        () => { load(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  async function handleClaimAll() {
    if (!user || claiming || claimingAll) return;
    const unclaimed = mail.filter(
      (m) => !m.claimed && !claimedIds.includes(m.id) && !dismissedIds.includes(m.id)
    );
    if (unclaimed.length === 0) return;
    setClaimingAll(true);
    setError(null);
    // Must be sequential — each call returns the updated save state; parallel
    // calls would each read the pre-claim state and the last write wins, dropping items.
    let latestResult = null;
    const newClaimedIds: string[] = [];
    for (const entry of unclaimed) {
      try {
        latestResult = await edgeClaimMail(entry.id);
        newClaimedIds.push(entry.id);
      } catch {
        // skip individual failures — partial progress is still progress
      }
    }
    if (latestResult) {
      update({
        ...state,
        coins:         latestResult.coins,
        inventory:     latestResult.inventory,
        fertilizers:   latestResult.fertilizers,
        gearInventory: latestResult.gearInventory,
        discovered:    latestResult.discovered,
      });
    }
    setClaimedIds((prev) => [...prev, ...newClaimedIds]);
    onCountChange?.(0);
    setClaimingAll(false);
  }

  async function handleClaim(entry: MailboxEntry) {
    if (!user || claiming || claimingAll) return;
    setClaiming(entry.id);
    setError(null);
    try {
      const result = await edgeClaimMail(entry.id);
      update({
        ...state,
        coins:         result.coins,
        inventory:     result.inventory,
        fertilizers:   result.fertilizers,
        gearInventory: result.gearInventory,
        discovered:    result.discovered,
      });
      audioManager.playSfx("buy");
      setClaimedIds((prev) => [...prev, entry.id]);
      setOpenId((prev) => prev === entry.id ? null : prev);
      onCountChange?.(mail.filter((m) => m.id !== entry.id && !m.claimed && !claimedIds.includes(m.id)).length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to claim");
    } finally {
      setClaiming(null);
    }
  }

  function handleDismiss(id: string) {
    setDismissedIds((prev) => [...prev, id]);
  }

  async function handleClearClaimed() {
    if (!user) return;
    const claimedAll = mail.filter((m) => m.claimed || claimedIds.includes(m.id)).map((m) => m.id);
    if (claimedAll.length === 0) return;
    // Optimistic: hide immediately so the UI feels instant
    setDismissedIds((prev) => [...new Set([...prev, ...claimedAll])]);
    // Persist deletion so cleared items don't reappear on refresh
    await clearClaimedMail(user.id, claimedAll);
    // Clean up local state
    setMail((prev) => prev.filter((m) => !claimedAll.includes(m.id)));
    setClaimedIds((prev) => prev.filter((id) => !claimedAll.includes(id)));
  }

  if (!user) return null;

  const visibleMail    = mail.filter((m) => !dismissedIds.includes(m.id));
  const unclaimedCount = visibleMail.filter((m) => !m.claimed && !claimedIds.includes(m.id)).length;
  const claimedCount   = visibleMail.filter((m) => m.claimed || claimedIds.includes(m.id)).length;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <p className="text-muted-foreground text-sm font-mono animate-pulse">Loading mailbox...</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Mailbox</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {unclaimedCount} unclaimed item{unclaimedCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {claimedCount > 0 && (
            <button
              onClick={handleClearClaimed}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear claimed
            </button>
          )}
          {unclaimedCount > 0 && (
            <button
              onClick={handleClaimAll}
              disabled={claimingAll || !!claiming}
              className="text-xs text-primary hover:opacity-80 transition-opacity disabled:opacity-50 font-semibold"
            >
              {claimingAll ? "Collecting..." : "Claim All"}
            </button>
          )}
          <button
            onClick={load}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-red-400 font-mono flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {visibleMail.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <p className="text-4xl">📬</p>
          <p className="font-medium text-muted-foreground">Mailbox empty</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Gifts from friends, sold listings, and marketplace purchases appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleMail.map((entry) => (
            <MailCard
              key={entry.id}
              entry={entry}
              claimed={entry.claimed || claimedIds.includes(entry.id)}
              claiming={claiming === entry.id}
              claimingAll={claimingAll}
              isOpen={openId === entry.id}
              onToggle={() => setOpenId((prev) => prev === entry.id ? null : entry.id)}
              onClaim={() => handleClaim(entry)}
              onDismiss={() => handleDismiss(entry.id)}
              onViewProfile={onViewProfile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mail card ─────────────────────────────────────────────────────────────────

function MailCard({
  entry,
  claimed,
  claiming,
  claimingAll,
  isOpen,
  onToggle,
  onClaim,
  onDismiss,
  onViewProfile,
}: {
  entry:         MailboxEntry;
  claimed:       boolean;
  claiming:      boolean;
  claimingAll:   boolean;
  isOpen:        boolean;
  onToggle:      () => void;
  onClaim:       () => void;
  onDismiss:     () => void;
  onViewProfile: (username: string) => void;
}) {
  // ── Resolve attachment display ─────────────────────────────────────────────
  const isCoins      = entry.kind === "coins";
  const isFertilizer = entry.kind === "fertilizer";
  const isGear       = entry.kind === "gear";
  const isFlower     = entry.kind === "flower" || entry.kind === "seed";

  let attachEmoji   = "📦";
  let attachSprite: string | undefined = undefined;
  let attachTitle   = "";
  let attachSub     = "";
  let attachFlowerSpecies: ReturnType<typeof getFlower> = undefined;
  let attachFlowerStage: "seed" | "bloom" = "bloom";

  if (isCoins) {
    attachEmoji  = "🟡";
    attachSprite = "/sprites/ui/coins.png";
    attachTitle  = `${formatCoins(entry.amount ?? 0)} coins`;

  } else if (isFertilizer && entry.species_id) {
    const fertType = entry.species_id.startsWith("fert:")
      ? entry.species_id.replace("fert:", "") as FertilizerType
      : entry.species_id as FertilizerType;
    const def = FERTILIZERS[fertType];
    if (def) {
      attachEmoji  = def.emoji;
      attachSprite = def.sprite;
      attachTitle  = def.name;
      attachSub    = `${def.speedMultiplier}× growth`;
    }

  } else if (isGear && entry.species_id) {
    const gearType = entry.species_id.startsWith("gear:")
      ? entry.species_id.replace("gear:", "") as GearType
      : entry.species_id as GearType;
    const def    = GEAR_CATALOG[gearType];
    const rarity = def ? RARITY_CONFIG[def.rarity] : null;
    if (def) {
      attachEmoji  = def.emoji;
      attachSprite = def.sprite;
      attachTitle  = def.name;
      attachSub    = rarity?.label ?? "Gear";
    }

  } else if (isFlower && entry.species_id) {
    const species = getFlower(entry.species_id);
    const mut     = entry.mutation ? MUTATIONS[entry.mutation as MutationType] : null;
    const rarity  = species ? RARITY_CONFIG[species.rarity] : null;
    if (species) {
      attachFlowerSpecies = species;
      attachFlowerStage   = entry.kind === "seed" ? "seed" : "bloom";
      attachEmoji = entry.kind === "seed"
        ? (species.emoji.seed ?? "🌱")
        : (species.emoji.bloom ?? "🌸");
      attachTitle = species.name + (entry.kind === "seed" ? " Seed" : "");
      attachSub   = [mut?.name, rarity?.label].filter(Boolean).join(" · ");
    }
  }

  const sender   = entry.from_profile;
  const isAdmin  = !sender && entry.subject !== "Listing Sold" && entry.subject !== "Marketplace Purchase";
  const subject  = entry.subject || (isCoins ? "Listing Sold" : "New Item");

  const bodyRef               = useRef<HTMLDivElement>(null);
  const [height, setHeight]   = useState<number | undefined>(undefined);

  // Measure content height whenever open changes so we can animate smoothly
  useEffect(() => {
    if (!bodyRef.current) return;
    setHeight(isOpen ? bodyRef.current.scrollHeight : 0);
  }, [isOpen, entry]);


  return (
    <div className={`border rounded-2xl overflow-hidden transition-all duration-300 ${isOpen ? "border-primary/40" : "border-border"} ${claimed ? "opacity-40" : "bg-card/60"}`}>

      {/* ── Collapsed header — always visible, click to toggle ── */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(); }}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary/5 transition-colors cursor-pointer"
      >
        {/* Sender avatar: profile flower for friends, 👑 for admin, 🏪 for marketplace */}
        <div className="relative flex-shrink-0 w-7 h-7 flex items-center justify-center">
          {sender ? (
            (() => {
              const sf  = getFlower(sender.display_flower);
              const sm  = sender.display_mutation ? MUTATIONS[sender.display_mutation as MutationType] : null;
              return sf
                ? <FlowerSprite species={sf} stage="bloom" imgSize="w-7 h-7" textSize="text-xl" className={sm?.vfxClass ?? ""} />
                : <span className="text-xl leading-none">🌱</span>;
            })()
          ) : isAdmin ? (
            <ItemSprite emoji="👑" sprite="/sprites/ui/admin.png" textSize="text-xl" imgSize="w-7 h-7" name="👑" />
          ) : (
            <ItemSprite emoji="🏪" sprite="/sprites/ui/social_market.png" textSize="text-xl" imgSize="w-7 h-7" name="🏪" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Subject line — strip trailing gift emoji and re-render as sprite */}
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {subject.endsWith(" 🎁") ? subject.slice(0, -2).trimEnd() : subject}
            </p>
            {subject.endsWith(" 🎁") && (
              <ItemSprite emoji="🎁" sprite="/sprites/ui/task_gift.png" textSize="text-sm" imgSize="w-4 h-4" name="🎁" className="flex-shrink-0" />
            )}
          </div>
          {/* From line — all inline-flex so sprites sit tight beside text */}
          <div className="flex items-center gap-0.5 text-xs text-muted-foreground overflow-hidden whitespace-nowrap">
            <span className="flex-shrink-0">
              {sender ? `From ${sender.username}` : isAdmin ? "From Admin" : "From Marketplace"}
            </span>
            {!sender && (
              <ItemSprite
                emoji={isAdmin ? "👑" : "🏪"}
                sprite={isAdmin ? "/sprites/ui/admin.png" : "/sprites/ui/social_market.png"}
                textSize="text-[10px]" imgSize="w-3 h-3"
                name={isAdmin ? "👑" : "🏪"}
                className="flex-shrink-0"
              />
            )}
            {attachTitle && (
              <>
                <span className="flex-shrink-0"> · </span>
                {attachFlowerSpecies
                  ? <FlowerSprite species={attachFlowerSpecies} stage={attachFlowerStage} imgSize="w-3 h-3" textSize="text-[10px]" />
                  : <ItemSprite emoji={attachEmoji} sprite={attachSprite} textSize="text-[10px]" imgSize="w-3 h-3" name={attachEmoji} className="flex-shrink-0" />
                }
                <span className="flex-shrink-0"> {attachTitle}</span>
              </>
            )}
            <span className="flex-shrink-0"> · {timeAgo(entry.created_at)}</span>
          </div>
        </div>

        {/* Chevron / dismiss */}
        {claimed ? (
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="text-muted-foreground hover:text-foreground text-xs flex-shrink-0 leading-none px-1"
            aria-label="Dismiss"
          >
            ✕
          </button>
        ) : (
          <span className={`text-muted-foreground text-xs transition-transform duration-200 flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}>
            ▼
          </span>
        )}
      </div>

      {/* ── Expandable body ── */}
      <div
        style={{ height: height ?? (isOpen ? "auto" : 0) }}
        className="overflow-hidden transition-[height] duration-200 ease-in-out"
      >
        <div ref={bodyRef} className="px-4 pb-4 space-y-3">

          {/* Sender line */}
          <p className="text-xs text-muted-foreground">
            {sender ? (
              <>
                From{" "}
                <button
                  onClick={(e) => { e.stopPropagation(); onViewProfile(sender.username); }}
                  className="text-primary hover:underline"
                >
                  {sender.username}
                </button>
              </>
            ) : isAdmin ? (
              <span className="inline-flex items-center gap-0.5">From Admin <ItemSprite emoji="👑" sprite="/sprites/ui/admin.png" textSize="text-xs" imgSize="w-3.5 h-3.5" name="👑" /></span>
            ) : (
              <span className="inline-flex items-center gap-0.5">From Marketplace <ItemSprite emoji="🏪" sprite="/sprites/ui/social_market.png" textSize="text-xs" imgSize="w-3.5 h-3.5" name="🏪" /></span>
            )}
            {" · "}{timeAgo(entry.created_at)}
          </p>

          {/* Body message */}
          {entry.message && (
            <div className="bg-background border border-border rounded-xl px-3 py-2">
              <p className="text-xs text-foreground/80 italic break-words">"{entry.message}"</p>
            </div>
          )}

          {/* Attachment */}
          {attachTitle && (
            <div className="flex items-center gap-3 bg-background/60 border border-border/60 rounded-xl px-3 py-2">
              <div className="relative flex-shrink-0 w-9 h-9 flex items-center justify-center">
                {attachFlowerSpecies
                  ? <FlowerSprite species={attachFlowerSpecies} stage={attachFlowerStage} imgSize="w-9 h-9" textSize="text-2xl" />
                  : <ItemSprite emoji={attachEmoji} sprite={attachSprite} textSize="text-2xl" imgSize="w-9 h-9" name={attachTitle} />
                }
                {isFlower && entry.mutation && (() => {
                  const em = MUTATIONS[entry.mutation as MutationType];
                  return em ? (
                    <span className="absolute -top-1 -right-1 leading-none">
                      <ItemSprite emoji={em.emoji} sprite={em.sprite} name={em.emoji} textSize="text-sm" imgSize="w-4 h-4" />
                    </span>
                  ) : null;
                })()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{attachTitle}</p>
                {attachSub && <p className="text-xs text-muted-foreground">{attachSub}</p>}
              </div>
            </div>
          )}

          {/* Collect button */}
          <button
            onClick={(e) => { e.stopPropagation(); onClaim(); }}
            disabled={claiming || claimingAll || claimed}
            className="w-full py-2 rounded-xl text-xs font-semibold text-center transition-opacity disabled:opacity-50 bg-primary text-primary-foreground hover:opacity-90"
          >
            {claimed
              ? "✓ Collected"
              : claiming
                ? "Collecting..."
                : isCoins
                  ? <span className="inline-flex items-center gap-0.5">Collect {formatCoins(entry.amount ?? 0)} <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-xs" imgSize="w-3.5 h-3.5" /></span>
                  : "Collect"}
          </button>
        </div>
      </div>
    </div>
  );
}
