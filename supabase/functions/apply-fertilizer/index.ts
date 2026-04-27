import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// base64url → base64 with proper padding for Deno's strict atob()
function b64url(s: string): string {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  return t + "=".repeat((4 - t.length % 4) % 4);
}

const VALID_FERTILIZER_TYPES = ["basic", "advanced", "premium", "elite", "miracle"];

interface FertilizerItem { type: string; quantity: number; }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    let userId: string;
    try {
      const p = JSON.parse(atob(b64url(token.split(".")[1])));
      userId = p.sub;
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse input ───────────────────────────────────────────────────────────
    const { row, col, fertType } = await req.json() as {
      row: number; col: number; fertType: string;
    };

    if (typeof row !== "number" || typeof col !== "number" || typeof fertType !== "string") {
      return new Response(JSON.stringify({ error: "Invalid input: row, col, fertType required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!VALID_FERTILIZER_TYPES.includes(fertType)) {
      return new Response(JSON.stringify({ error: "Invalid fertilizer type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Verify JWT + load save in parallel ────────────────────────────────────
    const [authResult, saveResult] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      supabaseAdmin.from("game_saves").select("grid, fertilizers").eq("user_id", userId).single(),
    ]);

    if (authResult.error || !authResult.data.user || authResult.data.user.id !== userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (saveResult.error || !saveResult.data) {
      return new Response(JSON.stringify({ error: "Save not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const save = saveResult.data;

    // ── Validate plot ─────────────────────────────────────────────────────────
    const grid = save.grid as { id: string; plant: Record<string, unknown> | null }[][];
    const plot = grid[row]?.[col];

    if (!plot) {
      return new Response(JSON.stringify({ error: "Plot does not exist" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!plot.plant) {
      return new Response(JSON.stringify({ error: "No plant in this plot" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (plot.plant.fertilizer) {
      return new Response(JSON.stringify({ error: "Plant already has fertilizer" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validate fertilizer ownership ─────────────────────────────────────────
    const fertilizers = (save.fertilizers ?? []) as FertilizerItem[];
    const fertItem = fertilizers.find((f) => f.type === fertType);

    if (!fertItem || fertItem.quantity < 1) {
      return new Response(JSON.stringify({ error: "No fertilizer of this type in inventory" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Compute changes ───────────────────────────────────────────────────────
    const newGrid = grid.map((r, ri) =>
      r.map((p, ci) =>
        ri === row && ci === col
          ? { ...p, plant: { ...p.plant!, fertilizer: fertType } }
          : p
      )
    );

    const newFertilizers = fertilizers
      .map((f) => f.type === fertType ? { ...f, quantity: f.quantity - 1 } : f)
      .filter((f) => f.quantity > 0);

    // ── Write to DB ───────────────────────────────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from("game_saves")
      .update({ grid: newGrid, fertilizers: newFertilizers, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to save" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    void supabaseAdmin.from("action_log").insert({
      user_id: userId, action: "apply_fertilizer",
      payload: { row, col, fertType },
      result:  { remainingFert: fertItem.quantity - 1 },
    });

    return new Response(
      JSON.stringify({ ok: true, grid: newGrid, fertilizers: newFertilizers }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("apply-fertilizer error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
