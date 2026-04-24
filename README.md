# 🌸 Chrysanthemum

A relaxing idle garden game where you grow flowers, discover rare species, and compete with friends.

**[Play now →](https://chrysanthemum-pink.vercel.app)**

---

## About

Chrysanthemum is a browser-based idle game built as a personal project. Plant seeds, tend your garden, harvest blooms, and work toward filling your Floral Codex — a living record of every species and mutation you've ever grown.

The game features full cloud save support with Google sign-in, a social system with friends and gifting, a global leaderboard, and over 80 unique flowers across five rarity tiers.

---

## Features

- **80+ flowers** across Common, Uncommon, Rare, Legendary, and Mythic rarities
- **6 mutations** — Golden, Rainbow, Giant, Moonlit, Frozen, Scorched — each multiplying a flower's sell value
- **Floral Codex** — collect every species and mutation variant to complete your codex
- **Farm upgrades** — expand from a 3×3 starter plot up to a 6×6 Grand Estate
- **Shop system** — randomised stock every 10 minutes, scales with farm size
- **Fertilizers** — speed up growth by 2×, 5×, or 10×
- **Cloud saves** — progress syncs across devices via Supabase
- **Guest play** — play without an account, upgrade to cloud save anytime
- **Social features** — friends list, flower gifting, global and friends leaderboard
- **Floral Codex on profiles** — view any player's collection and completion progress
- **Offline progress** — plants keep growing while you're away

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS |
| State | React Context + useReducer |
| Backend | Supabase (Postgres + Auth + Realtime) |
| Auth | Google OAuth via Supabase |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project
- Google OAuth credentials

### Local setup

```bash
# Clone the repo
git clone https://github.com/brimatt16219/Chrysanthemum.git
cd Chrysanthemum

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Fill in your Supabase URL and anon key

# Start dev server
npm run dev
```

### Environment variables

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Database setup

Run the SQL migrations in `/supabase/migrations/` against your Supabase project, or apply them manually via the SQL Editor in the Supabase dashboard.

---

## Project Structure

```
src/
├── components/       # UI components
│   ├── Garden.tsx
│   ├── Shop.tsx
│   ├── Inventory.tsx
│   ├── Codex.tsx
│   ├── ProfilePage.tsx
│   └── ...
├── data/
│   ├── flowers.ts    # All flower species + mutations
│   └── upgrades.ts   # Farm upgrades + fertilizers
├── store/
│   ├── gameStore.ts  # Core game logic + state types
│   ├── GameContext.tsx
│   └── cloudSave.ts  # Supabase read/write
├── hooks/
│   ├── useGrowthTick.ts
│   ├── useFriendRequests.ts
│   ├── useGiftNotifications.ts
│   └── useVersionCheck.ts
└── lib/
    └── supabase.ts
```

---

## Flower Rarities

| Rarity | Colour | Shop Weight | Example |
|---|---|---|---|
| Common | Gray | 50–70 | Daisy, Dandelion |
| Uncommon | Green | 20–32 | Rose, Snapdragon |
| Rare | Blue | 6–13 | Orchid, Passionflower |
| Legendary | Yellow | 2–5 | Lotus, Oracle Eye |
| Mythic | Pink | 0–2 | Chrysanthemum, Solar Rose |

Mythic flowers with `shopWeight: 0` never appear in the shop and must be discovered through other means.

---

## Mutations

Each flower has 2–6 possible mutations that can roll on harvest. Mutations multiply the flower's sell value and unlock separate Codex entries.

| Mutation | Multiplier | Chance |
|---|---|---|
| Golden ✨ | 3.0× | 5% |
| Rainbow 🌈 | 2.5× | 6% |
| Giant ⬆️ | 2.0× | 8% |
| Moonlit 🌙 | 2.0× | 7% |
| Frozen ❄️ | 1.5× | 10% |
| Scorched 🔥 | 1.5× | 10% |

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a full list of changes by version.

---

## License

MIT — feel free to fork and build your own garden game.
