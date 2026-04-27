import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALID_FERTILIZER_TYPES = ["basic", "premium", "miracle"];

interface FertilizerItem {
  type:     string;
  quantity: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse input ───────────────────────────────────────────────────────────
    const { row, col, fertType } = await req.json() as {
      row:      number;
      col:      number;
      fertType: string;
    };

    if (typeof row !== "number" || typeof col !== "number" || typeof fertType !== "string") {
      return new Response(JSON.stringify({ error: "Invalid input: row, col, fertType required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!VALID_FERTILIZER_TYPES.includes(fertType)) {
      return new Response(JSON.stringify({ error: "Invalid fertilizer type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Load save ─────────────────────────────────────────────────────────────
    const { data: save, error: saveError } = await supabaseAdmin
      .from("game_saves")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (saveError || !save) {
      return new Response(JSON.stringify({ error: "Save not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validate plot ─────────────────────────────────────────────────────────
    const grid = save.grid as { id: string; plant: Record<string, unknown> | null }[][];
    const plot = grid[row]?.[col];

    if (!plot) {
      return new Response(JSON.stringify({ error: "Plot does not exist" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!plot.plant) {
      return new Response(JSON.stringify({ error: "No plant in this plot" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (plot.plant.fertilizer) {
      return new Response(JSON.stringify({ error: "Plant already has fertilizer" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Plant must not be bloomed — bloomedAt being set means it's fully grown
    if (plot.plant.bloomedAt) {
      return new Response(JSON.stringify({ error: "Cannot fertilize a bloomed plant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validate fertilizer ownership ─────────────────────────────────────────
    const fertilizers = (save.fertilizers ?? []) as FertilizerItem[];
    const fertItem = fertilizers.find((f) => f.type === fertType);

    if (!fertItem || fertItem.quantity < 1) {
      return new Response(JSON.stringify({ error: "No fertilizer of this type in inventory" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Compute changes ───────────────────────────────────────────────────────
    const newGrid = grid.map((r, ri) =>
      r.map((p, ci) => {
        if (ri === row && ci === col) {
          return { ...p, plant: { ...p.plant!, fertilizer: fertType } };
        }
        return p;
      })
    );

    const newFertilizers = fertilizers
      .map((f) => f.type === fertType ? { ...f, quantity: f.quantity - 1 } : f)
      .filter((f) => f.quantity > 0);

    // ── Write to DB ───────────────────────────────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from("game_saves")
      .update({
        grid:        newGrid,
        fertilizers: newFertilizers,
        updated_at:  new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to save" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Log action ────────────────────────────────────────────────────────────
    await supabaseAdmin.from("action_log").insert({
      user_id: user.id,
      action:  "apply_fertilizer",
      payload: { row, col, fertType },
      result:  { remainingFert: (fertItem.quantity - 1) },
    });

    // ── Return delta ──────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        ok:          true,
        grid:        newGrid,
        fertilizers: newFertilizers,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    console.error("apply-fertilizer error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
