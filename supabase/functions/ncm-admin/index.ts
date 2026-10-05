import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://suru.com.np",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NCM_TOKEN = Deno.env.get("NCM_TOKEN")!;
const NCM_BASE = "https://nepalcanmove.com";

function getUserId(req: Request): string | null {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.sub || null;
  } catch { return null; }
}

async function supabase(path: string, init: RequestInit = {}, bearer = SERVICE_ROLE_KEY) {
  return fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: "Bearer " + bearer,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function requireAdmin(req: Request) {
  const userId = getUserId(req);
  if (!userId) throw new Error("Unauthorized");
  const r = await supabase(
    "admin_users?id=eq." + encodeURIComponent(userId) +
    "&is_active=eq.true&role=in.(admin,manager)&select=id"
  );
  if (!r.ok) {
    const detail = await r.text();
    console.error("Admin service-role lookup failed", r.status, detail);
    throw new Error("Unable to verify administrator");
  }
  const rows = await r.json();
  if (!rows?.length) throw new Error("Administrator access required");
}

async function ncm(path: string, init: RequestInit = {}, base = NCM_BASE) {
  if (!NCM_TOKEN) throw new Error("NCM_TOKEN secret is not configured");
  return fetch(base + path, {
    ...init,
    headers: {
      Authorization: "Token " + NCM_TOKEN,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "NepalCanMovePHPSDK",
      ...(init.headers || {}),
    },
  });
}

async function ncmJson(path: string, init: RequestInit = {}, base = NCM_BASE) {
  const r = await ncm(path, init, base);
  const text = await r.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  const contentType = r.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json") && /^\s*</.test(text)) {
    throw new Error("NCM returned a non-JSON response from " + path + " (HTTP " + r.status + ")");
  }
  if (!r.ok) {
    console.error("NCM upstream error", r.status, body);
    const message = body?.Error || body?.message || body?.detail || ("NCM API error (" + r.status + ")");
    const detail = typeof message === "string" ? message : JSON.stringify(message);
    throw new Error("NCM API error (" + r.status + "): " + detail);
  }
  return body;
}

function normalizeNcmDeliveryType(type: string): string {
  const map: Record<string, string> = {
    Door2Door: "Pickup/Collect",
    Branch2Door: "Send",
    Door2Branch: "D2B",
    Branch2Branch: "B2B",
  };
  return map[String(type || "").trim()] || String(type || "").trim();
}


function extractNcmTrackingId(value: any): string {
  const keys = ["tracking_id","trackingId","track_id","trackId","trackingid","trackid","tracking_number","trackingNumber"];
  const seen = new Set<any>();
  const walk = (v: any): string => {
    if (!v || typeof v !== "object" || seen.has(v)) return "";
    seen.add(v);
    if (Array.isArray(v)) {
      for (const item of v) {
        const found = walk(item);
        if (found) return found;
      }
      return "";
    }
    for (const key of keys) {
      const candidate = v[key];
      if (candidate !== undefined && candidate !== null && String(candidate).trim()) return String(candidate).trim();
    }
    for (const value of Object.values(v)) {
      const found = walk(value);
      if (found) return found;
    }
    return "";
  };
  return walk(value);
}

function mapNcmStatus(raw: string): string | null {
  const s = String(raw || "").toLowerCase().replace(/[_-]+/g, " ");
  if (s.includes("deliver")) return "delivered";
  if (s.includes("return")) return "returned";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("pickup order created") || s.includes("order created") || s.includes("created") || s.includes("process") || s.includes("warehouse") || s.includes("assigned")) return "processing";
  if (s.includes("pickup") || s.includes("transit") || s.includes("dispatch") || s.includes("arriv")) return "shipped";
  return null;
}

async function getOrder(orderId: string, _bearer: string = SERVICE_ROLE_KEY) {
  const r = await supabase("orders?id=eq." + encodeURIComponent(orderId) + "&select=*", {}, SERVICE_ROLE_KEY);
  if (!r.ok) {
    const detail = await r.text();
    throw new Error("Unable to load order" + (detail ? ": " + detail.slice(0, 500) : ""));
  }
  const rows = await r.json();
  if (!rows?.length) throw new Error("Order not found");
  return rows[0];
}

async function getOrderItems(orderId: string, _bearer: string = SERVICE_ROLE_KEY) {
  const r = await supabase("order_items?order_id=eq." + encodeURIComponent(orderId) + "&select=product_name,product_code,size,color,quantity", {}, SERVICE_ROLE_KEY);
  if (!r.ok) {
    const detail = await r.text();
    throw new Error("Unable to load order items" + (detail ? ": " + detail.slice(0, 500) : ""));
  }
  return await r.json();
}

async function updateOrder(orderId: string, patch: Record<string, unknown>, _bearer: string = SERVICE_ROLE_KEY) {
  const r = await supabase("orders?id=eq." + encodeURIComponent(orderId), {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  }, SERVICE_ROLE_KEY);
  if (!r.ok) throw new Error(await r.text());
  const rows = await r.json();
  return rows?.[0] || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    let requestBody: any = {};
    if (req.method === "POST") {
      try { requestBody = await req.clone().json(); } catch { requestBody = {}; }
    }
    const action = url.searchParams.get("action") || requestBody.action || (req.method === "GET" ? "branches" : "create");

    if (action === "branches") {
      const candidates = [[NCM_BASE, "/api/v2/branches"], [NCM_BASE, "/api/v2/branches/"], ["https://portal.nepalcanmove.com/api", "/v2/branches"], ["https://portal.nepalcanmove.com/api", "/v2/branches/"]];
      const errors: string[] = [];
      for (const [base, path] of candidates) {
        try {
          return json(await ncmJson(path, {}, base));
        } catch (e) {
          errors.push((base + path) + ": " + (e instanceof Error ? e.message : String(e)));
        }
      }
      throw new Error("NCM branch API unavailable. " + errors.join(" | "));
    }

    if (action === "rate") {
      const source = url.searchParams.get("source") || requestBody.source;
      const destination = url.searchParams.get("destination") || requestBody.destination;
      const type = url.searchParams.get("type") || requestBody.type || "Door2Door";
      const ncmType = normalizeNcmDeliveryType(type);
      if (!source || !destination) return json({ error: "source and destination are required" }, 400);
      const query = "?creation=" + encodeURIComponent(source) + "&destination=" + encodeURIComponent(destination) + "&type=" + encodeURIComponent(ncmType);
      const candidates = [[NCM_BASE, "/api/v1/shipping-rate" + query], ["https://portal.nepalcanmove.com/api", "/v1/shipping-rate" + query]];
      const errors: string[] = [];
      for (const [base, path] of candidates) {
        try {
          const result = await ncmJson(path, {}, base);
          const charge = Number(result?.charge ?? result?.delivery_charge ?? result?.data?.charge ?? result?.data?.delivery_charge ?? 0);
          return json({ ...result, charge: Number.isFinite(charge) ? charge : 0 });
        }
        catch (e) { errors.push((base + path) + ": " + (e instanceof Error ? e.message : String(e))); }
      }
      throw new Error("NCM shipping rate API unavailable. " + errors.join(" | "));
    }

    if (action === "configure-webhook" || action === "test-webhook") {
      const webhookSecret = Deno.env.get("NCM_WEBHOOK_SECRET");
      if (!webhookSecret) throw new Error("NCM_WEBHOOK_SECRET secret is not configured");
      const webhookUrl = SUPABASE_URL + "/functions/v1/ncm-webhook?secret=" + encodeURIComponent(webhookSecret);
      const endpoint = action === "test-webhook" ? "/v2/vendor/webhook/test" : "/v2/vendor/webhook";
      const r = await ncm(endpoint, {
        method: "POST",
        body: JSON.stringify({ webhook_url: webhookUrl })
      });
      const textBody = await r.text();
      let body: any = {};
      try { body = textBody ? JSON.parse(textBody) : {}; } catch { body = { raw: textBody }; }
      return json({
        success: r.ok,
        action,
        webhook_url: webhookUrl,
        ncm_status: r.status,
        ncm_response: body
      });
    }

    if (action === "sync") {
      const body = requestBody;
      const userToken = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
      if (!userToken) throw new Error("Unauthorized");
      const order = await getOrder(body.order_id, userToken);
      if (!order.ncm_order_id) throw new Error("This order has no NCM shipment");
      if (/^(cancelled|canceled)$/i.test(String(order.ncm_status || "").trim())) {
        return json({ order, history: null, preserved_cancelled: true });
      }
      let orderDetails: any = null;
      let trackingId = "";
      const detailErrors: string[] = [];
      for (const [base, path] of [
        [NCM_BASE, "/api/v1/order?id=" + encodeURIComponent(order.ncm_order_id)],
        ["https://portal.nepalcanmove.com", "/api/v1/order?id=" + encodeURIComponent(order.ncm_order_id)],
      ]) {
        try {
          orderDetails = await ncmJson(path, {}, base);
          trackingId = extractNcmTrackingId(orderDetails);
          if (trackingId) break;
        } catch (e) {
          detailErrors.push(base + path + ": " + (e instanceof Error ? e.message : String(e)));
        }
      }

      let history: any;
      const statusErrors: string[] = [];
      for (const [base, path] of [
        [NCM_BASE, "/api/v1/order/status?id=" + encodeURIComponent(order.ncm_order_id)],
        ["https://portal.nepalcanmove.com", "/api/v1/order/status?id=" + encodeURIComponent(order.ncm_order_id)],
      ]) {
        try {
          history = await ncmJson(path, {}, base);
          break;
        } catch (e) {
          statusErrors.push(base + path + ": " + (e instanceof Error ? e.message : String(e)));
        }
      }
      if (!history) throw new Error("NCM status sync failed. " + statusErrors.join(" | "));
      const list = Array.isArray(history) ? history : Array.isArray(history?.results) ? history.results : Array.isArray(history?.data) ? history.data : Array.isArray(history?.history) ? history.history : [];
      const latest = list.slice().sort((a: any,b: any) =>
        new Date(a.added_time || a.addedTime || a.timestamp || 0).getTime() -
        new Date(b.added_time || b.addedTime || b.timestamp || 0).getTime()
      ).pop();
      const rawStatus = latest?.status || latest?.event || order.ncm_status || "";
      const mapped = mapNcmStatus(rawStatus);
      const patch: Record<string, unknown> = {
        ncm_status: String(rawStatus || ""),
        ncm_last_sync_at: new Date().toISOString(),
      };
      if (trackingId && trackingId !== String(order.ncm_order_id)) {
        patch.ncm_tracking_id = trackingId;
      }
      if (mapped) patch.order_status = mapped;
      const updated = await updateOrder(order.id, patch, userToken);
      return json({ order: updated, history });
    }

    if (action === "create") {
      const body = await req.json();
      const userToken = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
      if (!userToken) throw new Error("Unauthorized");
      const order = await getOrder(body.order_id, userToken);
      if (order.ncm_order_id) return json({ error: "NCM shipment already exists", order }, 409);

      const sourceBranch = String(body.source_branch || "").trim();
      const destinationBranch = String(body.destination_branch || "").trim();
      if (!sourceBranch || !destinationBranch) throw new Error("Source and destination NCM branches are required");

      const items = await getOrderItems(order.id, userToken);
      const packageText = items.map((x: any) =>
        String(x.product_name || "") +
        (x.product_code ? " [" + x.product_code + "]" : "") +
        (x.size ? ", " + x.size : "") +
        (x.color ? ", " + x.color : "") +
        " × " + x.quantity
      ).join("; ");

      const customerPhone = String(order.customer_phone || "").replace(/\D/g, "").slice(-10);
      if (!/^9\d{9}$/.test(customerPhone)) {
        throw new Error("Customer phone number is invalid for NCM: " + String(order.customer_phone || "empty"));
      }
      const vrefId = String(order.order_number || order.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(-15);
      const payload = {
        name: String(order.customer_name || "").slice(0, 100),
        phone: customerPhone,
        phone2: "",
        cod_charge: order.payment_method === "cod" ? String(Number(order.total || 0)) : "0",
        address: [order.shipping_address, order.city, order.district, order.province, order.postal_code].filter(Boolean).join(", ").slice(0, 500),
        fbranch: sourceBranch,
        branch: destinationBranch,
        package: packageText.slice(0, 1000),
        vref_id: vrefId,
        instruction: order.customer_note || "",
        delivery_type: String(body.delivery_type || "Door2Door"),
        weight: String(body.weight || "1"),
      };

      let response: any;
      const createErrors: string[] = [];
      const createCandidates = [
        [NCM_BASE, "/api/v1/order/create"],
        ["https://portal.nepalcanmove.com", "/api/v1/order/create"],
      ];
      for (const [base, path] of createCandidates) {
        try {
          response = await ncmJson(path, {
            method: "POST",
            body: JSON.stringify(payload),
          }, base);
          break;
        } catch (e) {
          createErrors.push(base + path + ": " + (e instanceof Error ? e.message : String(e)));
        }
      }
      if (!response) throw new Error("NCM shipment creation failed. " + createErrors.join(" | "));

      const ncmOrderId = Number(response?.orderid ?? response?.orderId ?? response?.id);
      if (!Number.isFinite(ncmOrderId)) throw new Error("NCM did not return an order ID: " + JSON.stringify(response));

      let ncmDeliveryCharge = Number(response?.delivery_charge ?? response?.deliveryCharge ?? response?.charge ?? 0);
      if (!Number.isFinite(ncmDeliveryCharge) || ncmDeliveryCharge < 0) ncmDeliveryCharge = 0;
      const merchandiseTotal = Math.max(0, Number(order.subtotal || 0) - Number(order.discount_amount || order.discount || 0));
      if (merchandiseTotal >= 3000 || order.coupon_free_shipping) ncmDeliveryCharge = 0;
      if (merchandiseTotal < 3000 && !order.coupon_free_shipping && ncmDeliveryCharge === 0) {
        try {
          const rateQuery = "?creation=" + encodeURIComponent(sourceBranch) + "&destination=" + encodeURIComponent(destinationBranch) + "&type=" + encodeURIComponent(normalizeNcmDeliveryType(payload.delivery_type));
          const rate = await ncmJson("/api/v1/shipping-rate" + rateQuery);
          const rateCharge = Number(rate?.charge ?? rate?.delivery_charge ?? rate?.data?.charge ?? rate?.data?.delivery_charge ?? 0);
          if (Number.isFinite(rateCharge) && rateCharge > 0) ncmDeliveryCharge = rateCharge;
        } catch (e) { console.warn("Unable to fetch NCM delivery rate after shipment creation", e); }
      }
      const updatedSubtotal = Number(order.subtotal || 0);
      const existingDiscount = Number(order.discount_amount || order.discount || 0);
      const updatedTotal = Math.max(0, updatedSubtotal - existingDiscount + ncmDeliveryCharge);
      const patch = {
        ncm_order_id: ncmOrderId,
        ncm_tracking_id: String(response?.tracking_id ?? response?.trackingId ?? response?.track_id ?? response?.trackId ?? ""),
        ncm_status: "created",
        ncm_delivery_charge: ncmDeliveryCharge,
        shipping_fee: ncmDeliveryCharge,
        total: updatedTotal,
        ncm_delivery_type: String(response?.delivery_type || payload.delivery_type),
        ncm_source_branch: sourceBranch,
        ncm_destination_branch: destinationBranch,
        ncm_created_at: new Date().toISOString(),
        ncm_last_sync_at: new Date().toISOString(),
        ncm_response: response,
        order_status: order.order_status === "pending" ? "processing" : order.order_status,
      };
      const updated = await updateOrder(order.id, patch);
      return json({ success: true, order: updated, ncm: response });
    }

    if (["details","status_history","comments","add_comment","cancel_order","return","exchange","redirect"].includes(action)) {
      const body = requestBody;
      const userToken = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
      if (!userToken) throw new Error("Unauthorized");
      const order = await getOrder(body.order_id, userToken);
      if (!order.ncm_order_id) throw new Error("This order has no NCM shipment");
      const ncmId = String(order.ncm_order_id);

      const ncmCandidates = (path: string, init: RequestInit = {}) => {
        const candidates: Array<[string,string]> = [
          [NCM_BASE, path],
          ["https://portal.nepalcanmove.com", path],
          ["https://portal.nepalcanmove.com/api", path.replace(/^\/api/, "")],
        ];
        return candidates;
      };
      const callNcmCandidates = async (path: string, init: RequestInit = {}) => {
        const errors: string[] = [];
        for (const [base, candidatePath] of ncmCandidates(path, init)) {
          try {
            return await ncmJson(candidatePath, init, base);
          } catch (e) {
            errors.push(base + candidatePath + ": " + (e instanceof Error ? e.message : String(e)));
          }
        }
        throw new Error("NCM action failed. " + errors.join(" | "));
      };

      if (action === "details") {
        return json({ ncm: await callNcmCandidates("/api/v1/order?id=" + encodeURIComponent(ncmId)) });
      }
      if (action === "status_history") {
        return json({ history: await callNcmCandidates("/api/v1/order/status?id=" + encodeURIComponent(ncmId)) });
      }
      if (action === "comments") {
        const comments = await callNcmCandidates("/api/v1/order/comment?id=" + encodeURIComponent(ncmId));
        const collectText = (value: any): string => {
          if (value === null || value === undefined) return "";
          if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
          if (Array.isArray(value)) return value.map(collectText).join(" ");
          if (typeof value === "object") return Object.entries(value).map(([key, value]) => key + " " + collectText(value)).join(" ");
          return "";
        };
        const commentText = collectText(comments).toLowerCase();
        const cancellationConfirmed = /\bcancelled\b|\bcanceled\b|cancellation\\s+(?:is\\s+)?confirmed|successfully\\s+(?:cancelled|canceled)|shipment\\s+(?:is\\s+)?(?:cancelled|canceled)|order\\s+(?:is\\s+)?(?:cancelled|canceled)|vendor\\s+(?:has\\s+)?cancelled/i.test(commentText);
        return json({ comments, cancellation_confirmed: cancellationConfirmed });
      }
      if (action === "cancel_order" || action === "add_comment") {
        const comment = String(body.comment || "").trim();
        if (!comment) throw new Error("Comment is required");
        const response = await callNcmCandidates("/api/v1/comment", {
          method: "POST",
          body: JSON.stringify({ orderid: ncmId, comments: comment }),
        });
        if (action === "cancel_order") {
          const updated = await updateOrder(order.id, {
            ncm_status: "Cancelled",
            ncm_last_sync_at: new Date().toISOString(),
          }, SERVICE_ROLE_KEY);
          return json({ response, order: updated, cancellation_confirmed: true });
        }
        return json({ response });
      }
      if (action === "return") {
        const comment = String(body.comment || "").trim();
        const response = await callNcmCandidates("/api/v2/vendor/order/return", {
          method: "POST",
          body: JSON.stringify({ pk: Number(order.ncm_order_id), ...(comment ? { comment } : {}) }),
        });
        const deduction = Number(order.shipping_fee || 0) > 0 ? 0 : Math.max(0, Number(order.ncm_delivery_charge || 0));
        const updated = await updateOrder(order.id, { return_delivery_deduction: deduction }, SERVICE_ROLE_KEY);
        return json({ response, order: updated, return_delivery_deduction: deduction });
      }
      if (action === "exchange") {
        const response = await callNcmCandidates("/api/v2/vendor/order/exchange-create", {
          method: "POST",
          body: JSON.stringify({ pk: Number(order.ncm_order_id) }),
        });
        const deduction = Number(order.shipping_fee || 0) > 0 ? 0 : Math.max(0, Number(order.ncm_delivery_charge || 0));
        const updated = await updateOrder(order.id, { replacement_delivery_deduction: deduction }, SERVICE_ROLE_KEY);
        return json({ response, order: updated, replacement_delivery_deduction: deduction });
      }
      if (action === "redirect") {
        const name = String(body.name || "").trim();
        const phone = String(body.phone || "").replace(/\D/g, "").slice(-10);
        const address = String(body.address || "").trim();
        if (!name || !/^9\d{9}$/.test(phone) || !address) {
          throw new Error("Redirect requires a valid name, Nepal phone number and address");
        }
        return json({ response: await callNcmCandidates("/api/v2/vendor/order/redirect", {
          method: "POST",
          body: JSON.stringify({ pk: Number(order.ncm_order_id), name, phone, address }),
        }) });
      }
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});