// Deterministic daily task generation — seeded by userId + UTC date string
// so every player gets a consistent but unique set of 5 tasks per day.

export type DailyTaskType =
  | "harvest"
  | "marketplace_buy"
  | "marketplace_list"
  | "send_gift"
  | "shop_buy"
  | "apply_fertilizer"
  | "alchemy_sacrifice";

export interface DailyTask {
  type:      DailyTaskType;
  target:    number;   // goal quantity (1 for most; varies for harvest)
  progress:  number;   // current progress
  completed: boolean;
}

export interface DailyTaskState {
  date:             string;       // "YYYY-MM-DD" UTC
  tasks:            DailyTask[];
  rewardsCollected: boolean[];    // [tier1, tier2, tier3, tier4]
}

const TASK_POOL: DailyTaskType[] = [
  "harvest",
  "marketplace_buy",
  "marketplace_list",
  "send_gift",
  "shop_buy",
  "apply_fertilizer",
  "alchemy_sacrifice",
];

const TASKS_SHOWN    = 5;
const TASKS_REQUIRED = 4;
export { TASKS_REQUIRED };

// ── Minimal seeded PRNG (mulberry32) ─────────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed  = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t     = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function seedFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return h >>> 0;
}

// ── Public helpers ────────────────────────────────────────────────────────────
export function utcDateString(date = new Date()): string {
  return date.toISOString().slice(0, 10);   // "YYYY-MM-DD"
}

export function generateDailyTasks(userId: string, date: string): DailyTask[] {
  const rand    = mulberry32(seedFromString(`${userId}:${date}`));
  const pool    = [...TASK_POOL];
  const chosen: DailyTaskType[] = [];

  for (let i = 0; i < TASKS_SHOWN && pool.length > 0; i++) {
    const idx = Math.floor(rand() * pool.length);
    chosen.push(pool.splice(idx, 1)[0]);
  }

  return chosen.map((type) => ({
    type,
    target:    type === "harvest" ? 3 + Math.floor(rand() * 6) : 1,  // harvest: 3–8
    progress:  0,
    completed: false,
  }));
}

export function freshDailyState(userId: string, date = utcDateString()): DailyTaskState {
  return {
    date,
    tasks:            generateDailyTasks(userId, date),
    rewardsCollected: [false, false, false, false],
  };
}

export function isStale(state: DailyTaskState): boolean {
  return state.date !== utcDateString();
}
