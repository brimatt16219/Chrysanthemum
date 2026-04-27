import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { WEATHER, WEATHER_LIST } from "../data/weather";
import type { WeatherType } from "../data/weather";
import { FLOWERS, MUTATIONS } from "../data/flowers";
import type { MutationType } from "../data/flowers";
import { FERTILIZERS } from "../data/upgrades";
import type { FertilizerType } from "../data/upgrades";
import { useGame } from "../store/GameContext";
import { codexKey } from "../store/gameStore";

const DURATION_MS = 30_000;

async function setWeather(type: WeatherType) {
  await supabase.rpc("dev_set_weather", { p_type: type, p_duration_ms: DURATION_MS });
}

type Tab = "weather" | "items";

export function DevWeatherPanel() {
  const { state, update } = useGame();

  // ── Weather tab state ──────────────────────────────────────────────────────
  const [cycling, setCycling]   = useState(false);
  const [current, setCurrent]   = useState<WeatherType | null>(null);
  const cycleRef                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weatherTypes            = WEATHER_LIST.map((w) => w.id);

  // ── Items tab state ────────────────────────────────────────────────────────
  const [tab, setTab]               = useState<Tab>("weather");
  const [flowerSearch, setFlowerSearch] = useState("");
  const [selectedFlower, setSelectedFlower] = useState(FLOWERS[0].id);
  const [itemType, setItemType]     = useState<"seed" | "bloom">("seed");
  const [mutation, setMutation]     = useState<MutationType | "none">("none");
  const [quantity, setQuantity]     = useState(1);
  const [coins, setCoins]           = useState(1000);
  const [fertType, setFertType]     = useState<FertilizerType>("basic");
  const [fertQty, setFertQty]       = useState(5);
  const [toast, setToast]           = useState<string | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  // ── Weather helpers ────────────────────────────────────────────────────────
  function stopCycle() {
    if (cycleRef.current) clearTimeout(cycleRef.current);
    cycleRef.current = null;
    setCycling(false);
    setCurrent(null);
  }

  async function runCycle(remaining: WeatherType[]) {
    if (remaining.length === 0) { stopCycle(); return; }
    const [next, ...rest] = remaining;
    setCurrent(next);
    await setWeather(next);
    cycleRef.current = setTimeout(() => runCycle(rest), DURATION_MS + 500);
  }

  async function startCycle() {
    stopCycle();
    setCycling(true);
    await runCycle([...weatherTypes]);
  }

  useEffect(() => () => stopCycle(), []);

  // ── Item give actions ──────────────────────────────────────────────────────
  function giveItem() {
    const mut = mutation === "none" ? undefined : mutation as MutationType;
    const isSeed = itemType === "seed";

    const newInventory = [...state.inventory];
    const existing = newInventory.find(
      (i) => i.speciesId === selectedFlower && i.mutation === mut && !!i.isSeed === isSeed
    );
    if (existing) {
      existing.quantity += quantity;
    } else {
      newInventory.push({ speciesId: selectedFlower, quantity, mutation: mut, isSeed });
    }

    update({ ...state, inventory: newInventory });
    const flower = FLOWERS.find((f) => f.id === selectedFlower);
    showToast(`+${quantity} ${flower?.name ?? selectedFlower} ${isSeed ? "seed" : mut ? `(${mut})` : "bloom"}`);
  }

  function fillCodex() {
    const allMutations = Object.keys(MUTATIONS) as MutationType[];
    const newDiscovered = [...state.discovered];

    const baseKey = codexKey(selectedFlower);
    if (!newDiscovered.includes(baseKey)) newDiscovered.push(baseKey);
    for (const mut of allMutations) {
      const key = codexKey(selectedFlower, mut);
      if (!newDiscovered.includes(key)) newDiscovered.push(key);
    }

    update({ ...state, discovered: newDiscovered });
    const flower = FLOWERS.find((f) => f.id === selectedFlower);
    showToast(`Codex filled for ${flower?.name ?? selectedFlower}`);
  }

  function giveCoins() {
    update({ ...state, coins: state.coins + coins });
    showToast(`+${coins.toLocaleString()} coins`);
  }

  function giveFertilizer() {
    const newFertilizers = [...state.fertilizers];
    const existing = newFertilizers.find((f) => f.type === fertType);
    if (existing) {
      existing.quantity += fertQty;
    } else {
      newFertilizers.push({ type: fertType, quantity: fertQty });
    }
    update({ ...state, fertilizers: newFertilizers });
    showToast(`+${fertQty} ${FERTILIZERS[fertType].name}`);
  }

  // ── Filtered flower list ───────────────────────────────────────────────────
  const filteredFlowers = FLOWERS.filter((f) =>
    flowerSearch.trim() === "" ||
    f.name.toLowerCase().includes(flowerSearch.toLowerCase()) ||
    f.id.includes(flowerSearch.toLowerCase())
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-4 left-4 z-[100] bg-black/90 border border-yellow-500/40 rounded-2xl p-4 w-76 shadow-2xl text-xs max-h-[90vh] flex flex-col">

      {/* Header + tabs */}
      <div className="flex items-center gap-2 mb-3">
        <p className="font-bold text-yellow-400 flex-1">⚗️ Dev Panel</p>
        {toast && <span className="text-green-400 font-mono text-[10px] truncate">{toast}</span>}
      </div>

      <div className="flex gap-1 mb-3">
        {(["weather", "items"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1 rounded-lg text-[10px] font-semibold transition-all capitalize
              ${tab === t
                ? "bg-yellow-500/20 border border-yellow-500/50 text-yellow-400"
                : "bg-white/5 border border-white/10 text-white/50 hover:text-white/70"
              }`}
          >
            {t === "weather" ? "🌦 Weather" : "🎒 Items"}
          </button>
        ))}
      </div>

      {/* ── WEATHER TAB ─────────────────────────────────────────────────────── */}
      {tab === "weather" && (
        <>
          <div className="flex items-center justify-between mb-2">
            {cycling && (
              <button onClick={stopCycle} className="text-red-400 hover:text-red-300 font-semibold ml-auto">
                ✕ Stop
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {weatherTypes.map((type) => {
              const def = WEATHER[type];
              return (
                <button
                  key={type}
                  onClick={() => { stopCycle(); setCurrent(type); setWeather(type); }}
                  className={`
                    flex flex-col items-center gap-0.5 py-1.5 rounded-lg border transition-all
                    ${current === type
                      ? "border-yellow-400/80 bg-yellow-400/10 text-yellow-300"
                      : "border-white/10 bg-white/5 text-white/70 hover:border-white/30"
                    }
                  `}
                >
                  <span className="text-lg leading-none">{def.emoji}</span>
                  <span className="text-[9px] font-mono leading-none">{def.name.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={cycling ? stopCycle : startCycle}
            className={`
              w-full py-1.5 rounded-lg text-xs font-semibold transition-all text-center
              ${cycling
                ? "bg-red-500/20 border border-red-500/50 text-red-400"
                : "bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/30"
              }
            `}
          >
            {cycling ? `⏹ Stop cycle (on: ${WEATHER[current!]?.name ?? "…"})` : "▶ Auto-cycle all (30s each)"}
          </button>
        </>
      )}

      {/* ── ITEMS TAB ───────────────────────────────────────────────────────── */}
      {tab === "items" && (
        <div className="flex flex-col gap-3 overflow-y-auto min-h-0 flex-1">

          {/* Coins */}
          <div className="bg-white/5 rounded-xl p-2.5 space-y-1.5">
            <p className="text-yellow-400 font-semibold text-[10px] uppercase tracking-wide">Coins</p>
            <div className="flex gap-1.5">
              <input
                type="number"
                value={coins}
                min={1}
                onChange={(e) => setCoins(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-yellow-500/50"
              />
              <button
                onClick={giveCoins}
                className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 rounded-lg font-semibold hover:bg-yellow-500/30 transition-all"
              >
                Give
              </button>
            </div>
          </div>

          {/* Fertilizer */}
          <div className="bg-white/5 rounded-xl p-2.5 space-y-1.5">
            <p className="text-yellow-400 font-semibold text-[10px] uppercase tracking-wide">Fertilizer</p>
            <div className="flex gap-1.5">
              <select
                value={fertType}
                onChange={(e) => setFertType(e.target.value as FertilizerType)}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-yellow-500/50"
              >
                {Object.values(FERTILIZERS).map((f) => (
                  <option key={f.id} value={f.id}>{f.emoji} {f.name}</option>
                ))}
              </select>
              <input
                type="number"
                value={fertQty}
                min={1}
                onChange={(e) => setFertQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-12 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-yellow-500/50"
              />
              <button
                onClick={giveFertilizer}
                className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 rounded-lg font-semibold hover:bg-yellow-500/30 transition-all"
              >
                Give
              </button>
            </div>
          </div>

          {/* Flower */}
          <div className="bg-white/5 rounded-xl p-2.5 space-y-1.5">
            <p className="text-yellow-400 font-semibold text-[10px] uppercase tracking-wide">Flower</p>

            {/* Search */}
            <input
              type="text"
              value={flowerSearch}
              onChange={(e) => setFlowerSearch(e.target.value)}
              placeholder="Search flowers..."
              className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-yellow-500/50"
            />

            {/* Flower select */}
            <select
              value={selectedFlower}
              onChange={(e) => setSelectedFlower(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-yellow-500/50"
              size={4}
            >
              {filteredFlowers.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.emoji.bloom} {f.name} ({f.rarity})
                </option>
              ))}
            </select>

            {/* Seed / Bloom toggle */}
            <div className="flex gap-1">
              {(["seed", "bloom"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setItemType(t)}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-semibold transition-all capitalize
                    ${itemType === t
                      ? "bg-yellow-500/20 border border-yellow-500/50 text-yellow-400"
                      : "bg-white/5 border border-white/10 text-white/50 hover:text-white/70"
                    }`}
                >
                  {t === "seed" ? "🌱 Seed" : "🌸 Bloom"}
                </button>
              ))}
            </div>

            {/* Mutation (bloom only) */}
            {itemType === "bloom" && (
              <select
                value={mutation}
                onChange={(e) => setMutation(e.target.value as MutationType | "none")}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-yellow-500/50"
              >
                <option value="none">No mutation</option>
                {(Object.keys(MUTATIONS) as MutationType[]).map((m) => (
                  <option key={m} value={m}>{MUTATIONS[m].emoji} {MUTATIONS[m].name}</option>
                ))}
              </select>
            )}

            {/* Quantity + Give */}
            <div className="flex gap-1.5">
              <input
                type="number"
                value={quantity}
                min={1}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-yellow-500/50"
              />
              <button
                onClick={giveItem}
                className="flex-1 py-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 rounded-lg font-semibold hover:bg-yellow-500/30 transition-all"
              >
                Give Item
              </button>
            </div>

            {/* Fill codex */}
            <button
              onClick={fillCodex}
              className="w-full py-1 bg-green-500/20 border border-green-500/40 text-green-400 rounded-lg font-semibold hover:bg-green-500/30 transition-all"
            >
              ⚡ Fill Codex (all 10)
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
