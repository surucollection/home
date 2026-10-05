import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("NCM_WEBHOOK_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

function mapStatus(raw: string): string | null {
  const s = String(raw || "").toLowerCase().replace(/[_-]+/g, " ");
  if (s.includes("deliver")) return "delivered";
  if (s.includes("return")) return "returned";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("pickup") || s.includes("transit") || s.includes("dispatch") || s.includes("arriv") || s.includes("sent for delivery")) return "shipped";
  if (s.includes("process") || s.includes("warehouse") || s.includes("assigned") || s.includes("created")) return "processing";
  return null;
}

function extractOrderIds(payload: any): number[] {
  const candidates = [
    payload?.orderIds, payload?.order_ids, payload?.orderId, payload?.order_id,
    payload?.data?.orderIds, payload?.data?.order_ids, payload?.data?.orderId, payload?.data?.order_id,
    payload?.order?.id, payload?.data?.order?.id,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const ids = candidate.map((x) => Number(x)).filter(Number.isFinite);
      if (ids.length) return [...new Set(ids)];
    }
    const id = Number(candidate);
    if (Number.isFinite(id)) return [id];
  }
  return [];
}

async function patchOrder(ncmId: number, payload: any) {
  const rawStatus = payload?.event || payload?.status || payload?.orderStatus || payload?.order_status || "";
  const mapped = mapStatus(rawStatus);
  const patch: Record<string, unknown> = {
    ncm_status: String(rawStatus || ""),
    ncm_last_sync_at: new Date().toISOString(),
    ncm_response: payload,
  };
  if (mapped) patch.order_status = mapped;

  const response = await fetch(
    SUPABASE_URL + "/rest/v1/orders?ncm_order_id=eq." + encodeURIComponent(ncmId),
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: "Bearer " + SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    },
  );
  return response.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!WEBHOOK_SECRET) {
      return new Response("Webhook secret not configured", { status: 500, headers: corsHeaders });
    }

    const url = new URL(req.url);
    if (url.searchParams.get("secret") !== WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
    }

    const payload = await req.json();
    const ids = extractOrderIds(payload);

    if (!ids.length) {
      console.log("NCM webhook received without an order ID", JSON.stringify(payload));
      return new Response(JSON.stringify({
        success: true,
        acknowledged: true,
        test: true,
        message: "Webhook endpoint reachable; no order ID supplied.",
      }), { status: 200, headers: corsHeaders });
    }

    const results = await Promise.all(ids.map(async (id) => ({ id, updated: await patchOrder(id, payload) })));

    return new Response(JSON.stringify({
      success: results.every((item) => item.updated),
      updated: results.filter((item) => item.updated).length,
      order_ids: ids,
    }), { status: 200, headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }), { status: 400, headers: corsHeaders });
  }
});