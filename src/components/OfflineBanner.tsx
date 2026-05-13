import type { OfflineSummary } from "../store/gameStore";
import { getCurrentPeriod } from "../data/dayNight";
import type { ChangelogEntry } from "../data/changelog";
import { CHANGELOG_ITEM_ICONS } from "../data/changelog";
import { ItemSprite } from "./ItemSprite";

interface Props {
  summary:   OfflineSummary;
  onDismiss: () => void;
  changelog?: ChangelogEntry | null;
  username?: string | null;
}

const GREETINGS: Record<string, (name: string) => string> = {
  midnight:  (n) => `It's late night, ${n}`,
  dawn:      (n) => `Up early, ${n}?`,
  morning:   (n) => `Good morning, ${n}`,
  midday:    (n) => `Afternoon, ${n}`,
  afternoon: (n) => `Hey ${n}, afternoon check-in`,
  sunset:    (n) => `Evening, ${n}`,
  dusk:      (n) => `Getting late, ${n}`,
  night:     (n) => `Night owl, ${n}?`,
};

export function OfflineBanner({ summary, onDismiss, changelog, username }: Props) {
  const { minutesAway, readyToHarvest, shopRestocked, supplyRestocked, craftsReady, attunementsReady } = summary;

  const hasOfflineContent = minutesAway >= 1 || readyToHarvest || shopRestocked || supplyRestocked || craftsReady > 0 || attunementsReady > 0;

  // Nothing to show — skip
  if (!hasOfflineContent && !changelog) return null;

  const period   = getCurrentPeriod(new Date().getHours());
  const name     = username ?? "Guest";
  const greetFn  = GREETINGS[period.id];
  const greeting = greetFn ? greetFn(name) : `Welcome back, ${name}`;

  const h       = Math.floor(minutesAway / 60);
  const m       = minutesAway % 60;
  const timeAway = h > 0 ? `${h}h ${m}m` : `${m}m`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
      <div className="bg-card border border-primary/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl shadow-primary/10 space-y-4 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="flex justify-center">
            <ItemSprite emoji={period.emoji} sprite={`/sprites/ui/period_${period.id}.png`} name={period.label} textSize="text-3xl" imgSize="w-10 h-10" />
          </div>
          <h2 className="text-lg font-bold">{greeting}</h2>
          {minutesAway >= 1 && (
            <p className="text-sm text-muted-foreground">
              You were away for {timeAway}
            </p>
          )}
        </div>

        {/* Offline summary items */}
        {hasOfflineContent && (
          <div className="space-y-2">
            {readyToHarvest > 0 && (
              <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-xl px-4 py-3">
                <ItemSprite emoji="🌼" sprite="/sprites/ui/task_harvest.png" name="harvest" textSize="text-2xl" imgSize="w-7 h-7" />
                <div>
                  <p className="text-sm font-semibold">
                    {readyToHarvest} flower{readyToHarvest > 1 ? "s" : ""} ready to harvest
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Head to your garden to collect them
                  </p>
                </div>
              </div>
            )}
            {shopRestocked && (
              <div className="flex items-center gap-3 bg-card/80 border border-border rounded-xl px-4 py-3">
                <ItemSprite emoji="🛒" sprite="/sprites/ui/tab_shop.png" name="shop" textSize="text-2xl" imgSize="w-7 h-7" />
                <div>
                  <p className="text-sm font-semibold">Shop has restocked</p>
                  <p className="text-xs text-muted-foreground">
                    Fresh seeds and fertilizer available
                  </p>
                </div>
              </div>
            )}
            {supplyRestocked && (
              <div className="flex items-center gap-3 bg-card/80 border border-border rounded-xl px-4 py-3">
                <ItemSprite emoji="🧪" sprite="/sprites/ui/consumables.png" name="Supply shop" textSize="text-2xl" imgSize="w-7 h-7" />
                <div>
                  <p className="text-sm font-semibold">Supply shop has restocked</p>
                  <p className="text-xs text-muted-foreground">
                    Fresh gear and fertilizer available
                  </p>
                </div>
              </div>
            )}
            {craftsReady > 0 && (
              <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
                <ItemSprite emoji="⚒️" sprite="/sprites/ui/tab_craft.png" name="craft" textSize="text-2xl" imgSize="w-7 h-7" />
                <div>
                  <p className="text-sm font-semibold">
                    {craftsReady} craft{craftsReady > 1 ? "s" : ""} ready to collect
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Head to the Craft tab to claim them
                  </p>
                </div>
              </div>
            )}
            {attunementsReady > 0 && (
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
                <ItemSprite emoji="🌿" sprite="/sprites/ui/tab_alchemy.png" name="alchemy" textSize="text-2xl" imgSize="w-7 h-7" />
                <div>
                  <p className="text-sm font-semibold">
                    {attunementsReady} attunement{attunementsReady > 1 ? "s" : ""} ready to collect
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Head to the Alchemy → Attune tab
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Changelog section */}
        {changelog && (
          <div className="border border-primary/20 rounded-xl overflow-hidden flex flex-col min-h-0 flex-1">
            <div className="bg-primary/10 px-4 py-2 flex items-center gap-2 shrink-0">
              <span className="text-sm">📋</span>
              <p className="text-xs font-semibold text-primary">
                What's new in v{changelog.version} — {changelog.title}
              </p>
            </div>
            <ul className="px-4 py-3 space-y-1.5 overflow-y-auto">
              {changelog.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="mt-0.5 shrink-0">{CHANGELOG_ITEM_ICONS[item.type]}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={onDismiss}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity text-center shrink-0"
        >
          <span className="inline-flex items-center justify-center gap-1.5">Let's go! <ItemSprite emoji="🌱" sprite="/sprites/flowers/seed.png" name="🌱" textSize="text-sm" imgSize="w-4 h-4" /></span>
        </button>
      </div>
    </div>
  );
}
