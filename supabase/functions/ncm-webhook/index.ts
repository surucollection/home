import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("NCM_WEBHOOK_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://suru.com.np",
  "Access-Control-Allow-Headers": "authorization, x-cron-secret, x-ncm-webhook-secret, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function mapStatus(raw: string): string | null {
  const s = String(raw || "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("return")) return "returned";
  if (/\b(sent for delivery|out for delivery|on delivery|delivery in progress|delivery attempted|attempted delivery|unable to deliver|not delivered|undelivered|delivery failed|failed delivery|pending delivery)\b/.test(s)) return "shipped";
  if (
    s === "delivered" ||
    /\b(successfully delivered|delivered successfully|delivered to (the )?(customer|recipient)|order delivered|shipment delivered|delivery successful)\b/.test(s)
  ) return "delivered";
  if (s.includes("deliver") || s.includes("delivery")) return "shipped";
  if (s.includes("pickup") || s.includes("transit") || s.includes("dispatch") || s.includes("arriv")) return "shipped";
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

async function patchMatchingOrders(filter: string, patch: Record<string, unknown>) {
  const response = await fetch(
    SUPABASE_URL + "/rest/v1/orders?" + filter,
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: "Bearer " + SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(patch),
    },
  );
  if (!response.ok) {
    console.error("NCM webhook order update failed", response.status, await response.text());
    return 0;
  }
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows.length : 0;
}

async function patchOrder(ncmId: number, payload: any) {
  const rawStatus = payload?.event || payload?.status || payload?.orderStatus || payload?.order_status || "";
  const mapped = mapStatus(rawStatus);
  const now = new Date().toISOString();

  // Original forward shipment: update the main NCM and store order status fields.
  const originalPatch: Record<string, unknown> = {
    ncm_status: String(rawStatus || ""),
    ncm_last_sync_at: now,
    ncm_response: payload,
  };
  if (mapped) originalPatch.order_status = mapped;

  // Reverse shipment: update only its own tracking/status fields. Never overwrite
  // the customer's original delivery status with the reverse courier status.
  const reversePatch: Record<string, unknown> = {
    ncm_return_status: String(rawStatus || ""),
    ncm_return_last_sync_at: now,
  };

  const [originalUpdated, reverseUpdated] = await Promise.all([
    patchMatchingOrders("ncm_order_id=eq." + encodeURIComponent(ncmId), originalPatch),
    patchMatchingOrders("ncm_return_order_id=eq." + encodeURIComponent(ncmId), reversePatch),
  ]);

  return {
    original_updated: originalUpdated,
    reverse_updated: reverseUpdated,
    matched: originalUpdated + reverseUpdated > 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!WEBHOOK_SECRET) {
      return new Response("Webhook secret not configured", { status: 500, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const suppliedSecret =
      req.headers.get("x-ncm-webhook-secret") ||
      req.headers.get("x-cron-secret") ||
      url.searchParams.get("secret") ||
      "";
    if (suppliedSecret !== WEBHOOK_SECRET) {
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

    const results = await Promise.all(ids.map(async (id) => ({ id, ...(await patchOrder(id, payload)) })));

    return new Response(JSON.stringify({
      success: true,
      matched: results.filter((item) => item.matched).length,
      original_orders_updated: results.reduce((sum, item) => sum + item.original_updated, 0),
      reverse_returns_updated: results.reduce((sum, item) => sum + item.reverse_updated, 0),
      unmatched_order_ids: results.filter((item) => !item.matched).map((item) => item.id),
      order_ids: ids,
    }), { status: 200, headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }), { status: 400, headers: corsHeaders });
  }
});