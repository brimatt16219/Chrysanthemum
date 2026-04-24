## [v1.1.0] — 2026-04-24 — Weather Update

### Added
- Global weather system — all players see the same weather simultaneously via Supabase Realtime
- 7 weather types: Clear, Rain, Golden Hour, Prismatic Skies, Star Shower, Cold Front, Heatwave
- Rain doubles plant growth speed while active
- Each non-rain weather type doubles one mutation's chance on harvest
- Weather HUD banner with live countdown and weather name
- Full-screen visual overlays per weather type with CSS animations
- GitHub Actions cron job calling advance_weather() SQL function every 5 minutes
- 10 new fast-growing flowers (2 per rarity) for better early/mid-game pacing

### Fixed
- Weather banner countdown now clears client-side without requiring a page refresh
- Display flower picker now shows all codex-discovered flowers rather than inventory only
- Seeds filtered out of collection display and display flower picker
- Mobile layout restored to full width with responsive padding
