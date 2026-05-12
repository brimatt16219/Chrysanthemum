import { useState } from "react";
import { MarketplacePage } from "./MarketplacePage";
import { MyListingsPage } from "./MyListingsPage";
import { useGame } from "../store/GameContext";
import { ItemSprite } from "./ItemSprite";

type MarketView = "browse" | "my_listings";

interface Props {
  onViewProfile: (username: string) => void;
  onSignIn:      () => void;
}

export function MarketplaceTab({ onViewProfile, onSignIn }: Props) {
  const { user } = useGame();
  const [view, setView] = useState<MarketView>("browse");

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-5xl">🏪</p>
        <p className="font-semibold">Sign in to use the Marketplace</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Buy and sell flowers with other players from around the world.
        </p>
        <button
          onClick={onSignIn}
          className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Sub-nav */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setView("browse")}
          className={`
            flex-1 py-2 rounded-xl text-xs font-semibold transition-all text-center
            ${view === "browse"
              ? "bg-primary/20 border border-primary/50 text-primary"
              : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
            }
          `}
        >
          <span className="inline-flex items-center justify-center gap-1">
            <ItemSprite emoji="🛍️" sprite="/sprites/ui/market_browse.png" textSize="text-base" imgSize="w-5 h-5" name="browse" />
            <span className="hidden sm:inline">Browse</span>
          </span>
        </button>
        <button
          onClick={() => setView("my_listings")}
          className={`
            flex-1 py-2 rounded-xl text-xs font-semibold transition-all text-center
            ${view === "my_listings"
              ? "bg-primary/20 border border-primary/50 text-primary"
              : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
            }
          `}
        >
          <span className="inline-flex items-center justify-center gap-1">
            <ItemSprite emoji="📋" sprite="/sprites/ui/market_listings.png" textSize="text-base" imgSize="w-5 h-5" name="listings" />
            <span className="hidden sm:inline">My Listings</span>
          </span>
        </button>
      </div>

      {view === "browse"      && <MarketplacePage onViewProfile={onViewProfile} />}
      {view === "my_listings" && <MyListingsPage onRefreshNeeded={() => setView("browse")} />}
    </>
  );
}
