import { useState } from "react";
import { useGame } from "../store/GameContext";
import { sendGift } from "../store/cloudSave";
import { getFlower, RARITY_CONFIG, MUTATIONS } from "../data/flowers";
import { sellFlower } from "../store/gameStore";
import type { MutationType } from "../data/flowers";

interface Props {
  receiverId: string;
  receiverUsername: string;
  onClose: () => void;
  onSent: () => void;
}

export function SendGiftModal({ receiverId, receiverUsername, onClose, onSent }: Props) {
  const { user, state, update } = useGame();

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [message, setMessage]         = useState("");
  const [sending, setSending]         = useState(false);
  const [error, setError]             = useState("");

  // Only show flowers (items without mutation that are harvested blooms)
  // Actually show all inventory items — seeds and harvested are the same type
  const items = state.inventory.filter((i) => i.quantity > 0);

  async function handleSend() {
    if (!user || selectedIdx === null) return;
    const item = items[selectedIdx];
    if (!item) return;

    setSending(true);
    setError("");

    // Remove from local inventory first
    const next = sellFlower(state, item.speciesId, 1, item.mutation as MutationType | undefined);
    if (!next) {
      setError("Failed to remove item from inventory.");
      setSending(false);
      return;
    }

    // Insert gift row
    const ok = await sendGift(
      user.id,
      receiverId,
      item.speciesId,
      item.mutation,
      message.trim() || undefined
    );

    if (!ok) {
      setError("Failed to send gift. Try again.");
      setSending(false);
      return;
    }

    // Commit inventory change
    update(next);
    setSending(false);
    onSent();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
      <div className="bg-card border border-primary/30 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">Send a Gift</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              To: <span className="text-primary">{receiverUsername}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-3xl">🎒</p>
            <p className="text-sm text-muted-foreground">Your inventory is empty.</p>
            <p className="text-xs text-muted-foreground">Harvest some flowers first!</p>
          </div>
        ) : (
          <>
            {/* Item picker */}
            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wide mb-2">
                Select a flower
              </p>
              {items.map((item, idx) => {
                const species  = getFlower(item.speciesId);
                const mut      = item.mutation ? MUTATIONS[item.mutation as MutationType] : null;
                const rarity   = species ? RARITY_CONFIG[species.rarity] : null;
                const selected = selectedIdx === idx;
                if (!species) return null;

                return (
                  <button
                    key={`${item.speciesId}-${item.mutation ?? "none"}-${idx}`}
                    onClick={() => setSelectedIdx(selected ? null : idx)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left
                      ${selected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary/40"
                      }
                    `}
                  >
                    <div className="relative flex-shrink-0">
                      <span className="text-2xl">{species.emoji.bloom}</span>
                      {mut && <span className="absolute -top-1 -right-1 text-xs">{mut.emoji}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{species.name}</p>
                        {mut && <span className={`text-xs font-mono ${mut.color}`}>{mut.name}</span>}
                      </div>
                      <p className={`text-xs font-mono ${rarity?.color}`}>{rarity?.label}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">×{item.quantity}</span>
                  </button>
                );
              })}
            </div>

            {/* Message */}
            <div>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wide mb-1.5">
                Message (optional)
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="A little something for your garden..."
                maxLength={120}
                rows={2}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors resize-none"
              />
            </div>

            {error && <p className="text-xs text-red-400 font-mono">{error}</p>}

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={selectedIdx === null || sending}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 text-center"
            >
              {sending ? "Sending..." : selectedIdx !== null ? `Send ${getFlower(items[selectedIdx]?.speciesId)?.name ?? "flower"} 🎁` : "Select a flower to send"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}