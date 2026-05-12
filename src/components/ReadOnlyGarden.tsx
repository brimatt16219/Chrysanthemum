import { useMemo, useState, useEffect } from "react";
import { useSettings } from "../store/SettingsContext";
import { ItemSprite } from "./ItemSprite";
import { getCurrentStage, getStageProgress, getPassiveGrowthMultiplier, getDevShowGrowthDebug } from "../store/gameStore";
import type { Plot } from "../store/gameStore";
import { supabase } from "../lib/supabase";
import { getFlower, RARITY_CONFIG, MUTATIONS } from "../data/flowers";
import type { MutationType } from "../data/flowers";
import { WEATHER } from "../data/weather";
import type { WeatherType } from "../data/weather";
import { FERTILIZERS } from "../data/upgrades";

const WEATHER_MUT_LABEL: Partial<Record<WeatherType, string>> = {
  rain:            "wet",
  heatwave:        "scorched",
  cold_front:      "frozen",
  star_shower:     "moonlit",
  prismatic_skies: "rainbow",
  golden_hour:     "golden",
  tornado:         "windstruck",
  thunderstorm:    "→⚡ shocked",
};
import { GEAR, isGearExpired, getAffectedCells, CROPSTICKS_BREED_DURATION_MS } from "../data/gear";
import type { FanDirection } from "../data/gear";
import type React from "react";

interface Props {
  grid:      Plot[][];
  farmSize:  number;
  farmRows?: number;
}

export function ReadOnlyGarden({ grid, farmSize, farmRows }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const rows = farmRows ?? farmSize;
  const { settings } = useSettings();

  const [showGrowthDebug, setShowGrowthDebug] = useState(getDevShowGrowthDebug());
  const [debugWeatherType, setDebugWeatherType] = useState<WeatherType>("clear");

  useEffect(() => {
    const h = (e: Event) => setShowGrowthDebug((e as CustomEvent<boolean>).detail);
    window.addEventListener("devGrowthDebugToggle", h);
    return () => window.removeEventListener("devGrowthDebugToggle", h);
  }, []);

  // One-shot weather fetch for the debug overlay — avoids conflicting with the
  // app-level useWeather realtime channel that is already subscribed.
  useEffect(() => {
    if (!showGrowthDebug) return;
    supabase.from("weather").select("type").eq("id", 1).single()
      .then(({ data }) => { if (data) setDebugWeatherType(data.type as WeatherType); });
  }, [showGrowthDebug]);

  // Tick every second so progress bars and stage transitions animate in real-time
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Compute gear coverage in one pass
  const { regularSprinklerKeys, aqueductKeys, mutationSprinklerMap, scarecrowKeys, composterKeys, growLampKeys, fanCoveredCells, harvestBellKeys, lawnmowerCells, balanceScaleCells, autoPlanterKeys, aegisKeys } = useMemo(() => {
    const regular      = new Set<string>();
    const aqueduct     = new Set<string>();
    const mutation     = new Map<string, string[]>();
    const scarecrow    = new Set<string>();
    const composter    = new Set<string>();
    const growLamp     = new Set<string>();
    const fan          = new Map<string, FanDirection>();
    const harvestBell  = new Set<string>();
    const lawnmower    = new Map<string, FanDirection>();
    const balanceScale = new Map<string, "boost" | "slow">();
    const autoPlanter  = new Set<string>();
    const aegis        = new Set<string>();
    for (let ri = 0; ri < grid.length; ri++) {
      for (let ci = 0; ci < grid[ri].length; ci++) {
        const g = grid[ri][ci].gear;
        if (!g || isGearExpired(g, now)) continue;
        const def      = GEAR[g.gearType];
        const affected = getAffectedCells(g.gearType, ri, ci, rows, farmSize, g.direction);
        const keys     = affected.map(([r, c]) => `${r}-${c}`);
        if (def.category === "sprinkler_regular" && def.passiveSubtype !== "aqueduct") {
          keys.forEach((k) => regular.add(k));
        } else if (def.passiveSubtype === "aqueduct") {
          keys.forEach((k) => aqueduct.add(k));
        } else if (def.category === "sprinkler_mutation" && def.mutationType) {
          const emoji = MUTATIONS[def.mutationType as MutationType]?.emoji ?? "✨";
          keys.forEach((k) => {
            const existing = mutation.get(k);
            if (!existing) mutation.set(k, [emoji]);
            else if (!existing.includes(emoji)) existing.push(emoji);
          });
        } else if (def.passiveSubtype === "scarecrow") {
          keys.forEach((k) => scarecrow.add(k));
        } else if (def.passiveSubtype === "composter") {
          keys.forEach((k) => composter.add(k));
        } else if (def.passiveSubtype === "grow_lamp") {
          keys.forEach((k) => growLamp.add(k));
        } else if (def.passiveSubtype === "fan") {
          const dir = g.direction ?? "right";
          keys.forEach((k) => fan.set(k, dir));
        } else if (def.passiveSubtype === "harvest_bell") {
          keys.forEach((k) => harvestBell.add(k));
        } else if (def.passiveSubtype === "lawnmower") {
          const dir = g.direction ?? "right";
          keys.forEach((k) => lawnmower.set(k, dir));
        } else if (def.passiveSubtype === "balance_scale") {
          const phase = Math.floor(now / 3_600_000) % 2;
          affected.forEach(([r, c]) => {
            const dc     = c - ci;
            const inLeft = dc < 0;
            const isBoost = phase === 0 ? inLeft : !inLeft;
            balanceScale.set(`${r}-${c}`, isBoost ? "boost" : "slow");
          });
        } else if (def.passiveSubtype === "auto_planter") {
          keys.forEach((k) => autoPlanter.add(k));
        } else if (def.passiveSubtype === "aegis") {
          keys.forEach((k) => aegis.add(k));
        }
      }
    }
    return { regularSprinklerKeys: regular, aqueductKeys: aqueduct, mutationSprinklerMap: mutation, scarecrowKeys: scarecrow, composterKeys: composter, growLampKeys: growLamp, fanCoveredCells: fan, harvestBellKeys: harvestBell, lawnmowerCells: lawnmower, balanceScaleCells: balanceScale, autoPlanterKeys: autoPlanter, aegisKeys: aegis };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, farmSize, rows]);

  // Plant cells that are feeding an active cropsticks cycle — mapped to the
  // direction their particle should travel (toward the cropsticks).
  const crossbreedSourceCells = useMemo(() => {
    const map = new Map<string, "up" | "down" | "left" | "right">();
    const OFFSETS: [number, number, "up" | "down" | "left" | "right"][] = [
      [-1, 0, "down"],
      [ 1, 0, "up"  ],
      [ 0,-1, "right"],
      [ 0, 1, "left" ],
    ];
    for (let ri = 0; ri < grid.length; ri++) {
      for (let ci = 0; ci < grid[ri].length; ci++) {
        const g = grid[ri][ci].gear;
        if (!g || g.gearType !== "cropsticks") continue;
        if (g.crossbreedStartedAt == null) continue;
        // Prefer stored source coordinates
        if (g.crossbreedSourceA && g.crossbreedSourceB) {
          for (const { r: sr, c: sc } of [g.crossbreedSourceA, g.crossbreedSourceB]) {
            if (!grid[sr]?.[sc]?.plant) continue;
            for (const [dr, dc, dir] of OFFSETS) {
              if (ri + dr === sr && ci + dc === sc) { map.set(`${sr}-${sc}`, dir); break; }
            }
          }
          continue;
        }
        // Fallback: legacy cycles with infused flag still set
        for (const [dr, dc, dir] of OFFSETS) {
          const nr = ri + dr; const nc = ci + dc;
          const p = grid[nr]?.[nc]?.plant;
          if (p?.infused) map.set(`${nr}-${nc}`, dir);
        }
      }
    }
    return map;
  }, [grid]);

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs font-mono text-muted-foreground tracking-wide uppercase">
        {rows}×{farmSize} Garden
      </p>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${farmSize}, minmax(0, 1fr))` }}
      >
        {grid.flat().map((plot, i) => {
          const ri = Math.floor(i / farmSize);
          const ci = i % farmSize;
          const cellKey = `${ri}-${ci}`;

          const plant   = plot.plant;
          const gear    = plot.gear;

          // ── Gear cell ──────────────────────────────────────────────────────
          if (gear) {
            const def         = GEAR[gear.gearType];
            const gearRarity  = RARITY_CONFIG[def.rarity];
            const expired     = isGearExpired(gear, now);
            const storedCount = gear.storedFertilizers?.length ?? 0;
            const expiryProg  = def.durationMs
              ? Math.max(0, (gear.placedAt + def.durationMs - now) / def.durationMs)
              : null;

            // Prismatic uses "rainbow-text" and Exalted uses "text-black" — both need manual mapping
            const gearBarBg = gearRarity.color === "rainbow-text"
              ? "bg-gradient-to-r from-pink-400 via-violet-400 to-sky-400"
              : gearRarity.color === "text-black"
                ? "bg-slate-300"
                : gearRarity.color.replace("text-", "bg-");

            // Prismatic gear: drive all three rainbow animations via inline style so CSS
            // cascade order doesn't clobber them (inline style wins over class-based animation).
            const prismaticStyle: React.CSSProperties | undefined = def.rarity === "prismatic"
              ? { animation: "rainbow-border-cycle 3s linear infinite, rainbow-bg-cycle 3s linear infinite, rainbow-glow-cycle 3s linear infinite" }
              : undefined;

            return (
              <div
                key={plot.id}
                style={prismaticStyle}
                className={`
                  relative w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center
                  ${gearRarity.borderBloom} ${gearRarity.bgBloom} ${gearRarity.glow}
                  ${expired ? "opacity-50" : ""}
                `}
                title={`${def.name} — ${def.rarity}`}
              >
                <ItemSprite emoji={def.emoji} sprite={def.sprite} name={def.name} textSize="text-xl" imgSize="w-6 h-6" />

                {/* Mutation sprinkler overlay */}
                {def.category === "sprinkler_mutation" && def.mutationType && (
                  <span className="absolute -bottom-0.5 -right-1 text-xs leading-none">
                    {MUTATIONS[def.mutationType].emoji}
                  </span>
                )}

                {/* Expiry bar */}
                {expiryProg !== null && !expired && (
                  <div className="absolute bottom-1 left-2 right-2 h-0.5 bg-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${gearBarBg}`}
                      style={{ width: `${expiryProg * 100}%` }}
                    />
                  </div>
                )}

                {/* Cropsticks crossbreed progress bar */}
                {def.passiveSubtype === "cropsticks" && gear.crossbreedStartedAt != null && (() => {
                  const cropProg = Math.min(1, Math.max(0, (now - (gear.crossbreedStartedAt as number)) / CROPSTICKS_BREED_DURATION_MS));
                  return (
                    <div
                      className="absolute bottom-1 left-2 right-2 h-0.5 bg-border rounded-full overflow-hidden"
                      title={`Cross-breeding · ${Math.floor(cropProg * 100)}%`}
                    >
                      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${cropProg * 100}%` }} />
                    </div>
                  );
                })()}

                {/* Composter stored count */}
                {def.passiveSubtype === "composter" && storedCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 text-[9px] font-mono font-bold text-primary leading-none">
                    {storedCount}
                  </span>
                )}
              </div>
            );
          }

          // ── Empty cell ─────────────────────────────────────────────────────
          if (!plant) {
            return (
              <div
                key={plot.id}
                className="w-14 h-14 rounded-xl border-2 border-border bg-card/40 flex items-center justify-center"
              >
                <span className="text-xl opacity-20">·</span>
              </div>
            );
          }

          // ── Plant cell ─────────────────────────────────────────────────────
          const species     = getFlower(plant.speciesId);
          const gearMult    = getPassiveGrowthMultiplier(grid, ri, ci, now);
          const stage       = getCurrentStage(plant, now, "clear", gearMult);
          const progress    = getStageProgress(plant, now, "clear", gearMult);
          const rarity    = species ? RARITY_CONFIG[species.rarity] : null;
          const isBloomed = stage === "bloom";
          const mut       = (isBloomed && plant.mutation)
            ? MUTATIONS[plant.mutation as MutationType]
            : null;
          const hasFert   = !!plant.fertilizer;

          const underSprinkler   = regularSprinklerKeys.has(cellKey);
          const underAqueduct    = aqueductKeys.has(cellKey);
          const mutEmojis        = mutationSprinklerMap.get(cellKey) ?? [];
          const underScarecrow   = scarecrowKeys.has(cellKey);
          const underComposter   = composterKeys.has(cellKey);
          const underGrowLamp    = growLampKeys.has(cellKey);
          const underFan         = fanCoveredCells.has(cellKey);
          const fanDirection     = fanCoveredCells.get(cellKey);
          const underHarvestBell  = harvestBellKeys.has(cellKey);
          const underLawnmower    = lawnmowerCells.has(cellKey);
          const lawnmowerDir      = lawnmowerCells.get(cellKey);
          const balanceScaleSide  = balanceScaleCells.get(cellKey) as "boost" | "slow" | undefined;
          const underAutoPlanter  = autoPlanterKeys.has(cellKey);
          const underAegis        = aegisKeys.has(cellKey);

          const crossbreedDirection = crossbreedSourceCells.get(cellKey);
          const prismaticStyle: React.CSSProperties | undefined =
            isBloomed && species?.rarity === "prismatic"
              ? { animation: "rainbow-border-cycle 3s linear infinite, rainbow-bg-cycle 3s linear infinite, rainbow-glow-cycle 3s linear infinite" }
              : undefined;

          return (
            <div
              key={plot.id}
              style={prismaticStyle}
              className={`
                relative w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center
                ${isBloomed
                  ? `${rarity?.borderBloom ?? "border-primary/50"} ${rarity?.bgBloom ?? "bg-primary/10"} ${rarity?.glow ?? ""}`
                  : `${rarity?.borderGrowing ?? "border-border/60"} bg-card/60`
                }
                ${plant.infused ? "ring-2 ring-emerald-400/60" : ""}
              `}
              title={isBloomed ? `${species?.name} — bloomed` : "??? — growing"}
            >
              {/* ── Gear ambient animation overlay (clipped to cell) ── */}
              {settings.plotAnimations && !crossbreedSourceCells.has(cellKey) && (underSprinkler || underAqueduct || mutEmojis.length > 0 || underGrowLamp || underScarecrow || underComposter || underAutoPlanter || underHarvestBell || underLawnmower || !!balanceScaleSide || underFan || underAegis) && (
                <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                  {underGrowLamp && <div className="absolute inset-0 gear-lamp-glow" />}
                  {underSprinkler && !underAqueduct && (
                    <>
                      <span className="gear-drop" style={{ left: "15%", animationDelay: "-1.2s" }}>💧</span>
                      <span className="gear-drop" style={{ left: "48%", animationDelay: "-0.6s" }}>💧</span>
                      <span className="gear-drop" style={{ left: "74%", animationDelay: "0s"    }}>💧</span>
                    </>
                  )}
                  {underAqueduct && (
                    <>
                      <span className="gear-drop" style={{ left: "15%", animationDelay: "-1.2s" }}>💧</span>
                      <span className="gear-drop" style={{ left: "48%", animationDelay: "-0.6s" }}>💧</span>
                      <span className="gear-drop" style={{ left: "74%", animationDelay: "0s"    }}>💧</span>
                    </>
                  )}
                  {mutEmojis.flatMap((emoji, mi) => [
                    <span key={`m${mi}a`} className="gear-float" style={{ left: `${16 + mi * 28}%`, animationDelay: `${mi * 0.5 - 2}s`   }}>{emoji}</span>,
                    <span key={`m${mi}b`} className="gear-float" style={{ left: `${40 + mi * 28}%`, animationDelay: `${mi * 0.5 - 0.9}s` }}>{emoji}</span>,
                  ])}
                  {underScarecrow && (
                    <>
                      <span className="gear-bird" style={{ left: "10%", animationDelay: "-1.5s" }}>🐦</span>
                      <span className="gear-bird" style={{ left: "52%", animationDelay: "0s"    }}>🐦</span>
                    </>
                  )}
                  {underComposter && (
                    <>
                      <span className="gear-compost-spark" style={{ left: "18%", animationDelay: "-1.5s"  }}>✦</span>
                      <span className="gear-compost-spark" style={{ left: "50%", animationDelay: "-0.75s" }}>✦</span>
                      <span className="gear-compost-spark" style={{ left: "76%", animationDelay: "0s"     }}>✦</span>
                    </>
                  )}
                  {underFan && (() => {
                    const dir   = fanDirection ?? "right";
                    const cls   = `gear-wind-${dir}`;
                    const horiz = dir === "left" || dir === "right";
                    const axis  = horiz ? "top" : "left";
                    return (["18%", "50%", "76%"] as const).map((pos, fi) => (
                      <span key={fi} className={cls} style={{ [axis]: pos, animationDelay: `${fi * 0.65 - 1.3}s` }}>💨</span>
                    ));
                  })()}
                  {underAutoPlanter && (
                    <>
                      <span className="gear-planter-seed" style={{ left: "20%", animationDelay: "-1.6s" }}>🌱</span>
                      <span className="gear-planter-seed" style={{ left: "52%", animationDelay: "-0.8s" }}>🌱</span>
                      <span className="gear-planter-seed" style={{ left: "76%", animationDelay: "0s"    }}>🌱</span>
                    </>
                  )}
                  {underHarvestBell && (
                    <>
                      <span className="gear-bell" style={{ left: "18%", animationDelay: "-2.2s" }}>🔔</span>
                      <span className="gear-bell" style={{ left: "52%", animationDelay: "-1.1s" }}>🔔</span>
                      <span className="gear-bell" style={{ left: "74%", animationDelay: "0s"    }}>🔔</span>
                    </>
                  )}
                  {underLawnmower && (() => {
                    const dir   = lawnmowerDir ?? "right";
                    const cls   = `gear-mow-${dir}`;
                    const horiz = dir === "left" || dir === "right";
                    const axis  = horiz ? "top" : "left";
                    return (["18%", "50%", "76%"] as const).map((pos, li) => (
                      <span key={li} className={cls} style={{ [axis]: pos, animationDelay: `${li * 0.6 - 1.2}s` }}>🍃</span>
                    ));
                  })()}
                  {balanceScaleSide === "boost" && (
                    <>
                      <span className="gear-scale-boost" style={{ left: "18%", animationDelay: "-1.2s" }}>✦</span>
                      <span className="gear-scale-boost" style={{ left: "50%", animationDelay: "-0.5s" }}>✦</span>
                      <span className="gear-scale-boost" style={{ left: "76%", animationDelay: "0s"    }}>✦</span>
                    </>
                  )}
                  {balanceScaleSide === "slow" && (
                    <>
                      <span className="gear-scale-slow" style={{ left: "18%", animationDelay: "-1.6s" }}>▾</span>
                      <span className="gear-scale-slow" style={{ left: "50%", animationDelay: "-0.8s" }}>▾</span>
                      <span className="gear-scale-slow" style={{ left: "76%", animationDelay: "0s"    }}>▾</span>
                    </>
                  )}
                  {/* Aegis: 🛡️ shields rising — weather mutations blocked */}
                  {underAegis && (
                    <>
                      <span className="gear-aegis-shield" style={{ left: "15%", animationDelay: "-1.8s" }}>🛡️</span>
                      <span className="gear-aegis-shield" style={{ left: "50%", animationDelay: "-0.9s" }}>🛡️</span>
                      <span className="gear-aegis-shield" style={{ left: "76%", animationDelay: "0s"    }}>🛡️</span>
                    </>
                  )}
                </div>
              )}

              {/* Crossbreed particle overlay — emerald dots drift toward adjacent cropsticks */}
              {settings.plotAnimations && !!crossbreedDirection && (
                <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                  {(["0s", "-0.55s", "-1.1s"] as const).map((delay, i) => {
                    const horiz = crossbreedDirection === "left" || crossbreedDirection === "right";
                    return (
                      <div
                        key={i}
                        className="cross-particle"
                        style={{
                          animationName: `cross-particle-${crossbreedDirection}`,
                          animationDuration: "1.4s",
                          animationDelay: delay,
                          left: horiz ? "42%" : `${20 + i * 22}%`,
                          top:  horiz ? `${20 + i * 22}%` : "42%",
                        }}
                      />
                    );
                  })}
                </div>
              )}

              <span className="text-xl leading-none">
                {species?.emoji[stage!] ?? "🌱"}
              </span>

              {/* Fertilizer — top-left */}
              {settings.plotFertilizerIndicator && hasFert && !isBloomed && (
                <span className="absolute top-0.5 left-0.5 leading-none">
                  <ItemSprite
                    emoji={FERTILIZERS[plant.fertilizer!].emoji}
                    sprite={FERTILIZERS[plant.fertilizer!].sprite}
                    name={FERTILIZERS[plant.fertilizer!].name}
                    textSize="text-[9px]"
                    imgSize="w-3 h-3"
                  />
                </span>
              )}

              {/* Mastery — top-right */}
              {settings.plotMasteryIndicator && plant.masteredBonus && (
                <span className="absolute top-0.5 right-0.5 text-[9px] leading-none text-yellow-400" title="Mastered">
                  ⚡
                </span>
              )}

              {/* Gear effect indicators — bottom-left */}
              {settings.plotGearIndicator && (underSprinkler || underAqueduct || mutEmojis.length > 0 || underScarecrow || underComposter || underGrowLamp || underFan || underHarvestBell || underAutoPlanter || !!balanceScaleSide || underAegis || plant.infused || plant.revealed) && (
                <div className={`absolute left-0.5 flex leading-none ${isBloomed ? "bottom-1" : "bottom-2"}`}>
                  {underAqueduct && <span className="text-[9px]" title="Under aqueduct">⛲</span>}
                  {underSprinkler && !underAqueduct && <span className="text-[9px]" title="Under sprinkler">💧</span>}
                  {mutEmojis.map((emoji, i) => (
                    <span key={i} className="text-[9px]" title="Mutation sprinkler">{emoji}</span>
                  ))}
                  {underScarecrow && <span className="text-[9px]" title="Under scarecrow">🧹</span>}
                  {underComposter && <span className="text-[9px]" title="Near composter">🧺</span>}
                  {underGrowLamp && <span className="text-[9px]" title="Under grow lamp">💡</span>}
                  {underFan && <span className="text-[9px]" title="In fan range">💨</span>}
                  {underHarvestBell && <span className="text-[9px]" title="Auto-harvest active">🔔</span>}
                  {underAutoPlanter && <span className="text-[9px]" title="Auto-planter active">🌱</span>}
                  {balanceScaleSide === "boost" && <span className="text-[9px]" title="Balance Scale — 3× boost">⚖️</span>}
                  {balanceScaleSide === "slow"  && <span className="text-[9px]" title="Balance Scale — 0.5× slow">⚖️</span>}
                  {underAegis && <span className="text-[9px]" title="Aegis — weather mutations blocked">🛡️</span>}
                  {plant.infused && <span className="text-[9px]" title="Infused — cross-breeding active">💉</span>}
                  {plant.revealed && <span className="text-[9px]" title="Species revealed — Magnifying Glass used">🔎</span>}
                </div>
              )}

              {/* Progress bar */}
              {!isBloomed && (
                <div className="absolute bottom-1 left-2 right-2 h-0.5 bg-border rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${hasFert ? "bg-green-400" : "bg-primary"}`}
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              )}

              {/* Growth debug overlay — dev only */}
              {showGrowthDebug && (() => {
                const wType  = debugWeatherType;
                const wMult  = WEATHER[wType]?.growthMultiplier ?? 1;
                const fMult  = plant.fertilizer ? FERTILIZERS[plant.fertilizer].speedMultiplier : 1;
                const mMult  = plant.masteredBonus ?? 1;
                const total  = fMult * mMult * wMult * gearMult;
                const mutLbl = WEATHER_MUT_LABEL[wType] ?? null;
                return (
                  <div className="absolute top-0.5 inset-x-0 flex justify-center pointer-events-none z-20">
                    <span className="bg-black/75 rounded px-0.5 text-[7px] font-mono leading-tight text-cyan-300 whitespace-nowrap">
                      {total.toFixed(2)}×{mutLbl ? ` ${mutLbl}` : ""}
                    </span>
                  </div>
                );
              })()}

              {/* Top-right: pin badge overrides bloom pulse */}
              {plant.pinned ? (
                <span className="absolute -top-1 -right-1 text-sm leading-none" title="Pinned — auto-harvest blocked">
                  📌
                </span>
              ) : isBloomed ? (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
              ) : null}

              {/* Mutation emoji */}
              {settings.plotMutationIndicator && mut && (
                <span className="absolute -bottom-1 -right-1 text-sm leading-none">
                  {mut.emoji}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
