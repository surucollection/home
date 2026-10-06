import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const NCM_TOKEN = Deno.env.get("NCM_TOKEN") || "";

const ORIGIN_BRANCH = "GAUR";
const DELIVERY_TYPE = "Pickup/Collect";
const DOOR_PICKUP_CHARGE = 15;
const CACHE_TTL_MS = 15 * 60 * 1000;
const NCM_RATE_BASES = [
  "https://nepalcanmove.com",
  "https://portal.nepalcanmove.com",
];

const admin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const cors = {
  "Access-Control-Allow-Origin": "https://suru.com.np",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ncmFetch(
  url: string,
  init: RequestInit = {},
  retries = 2,
) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          ...(init.headers || {}),
          Authorization: "Token " + NCM_TOKEN,
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "NepalCanMovePHPSDK",
        },
      });

      if (response.status !== 429 || attempt === retries) {
        return response;
      }

      const retryAfter = Number(response.headers.get("Retry-After") || 0);
      const waitMs = Math.max(
        1100,
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 5000)
          : 1100,
      );

      await response.arrayBuffer().catch(() => {});
      await sleep(waitMs);
    } catch (error) {
      if (attempt === retries) throw error;
      await sleep(1100);
    }
  }

  throw new Error("NCM rate request failed after retry");
}

function extractCharge(body: any): number | null {
  const candidates = [
    body?.charge,
    body?.delivery_charge,
    body?.data?.charge,
    body?.data?.delivery_charge,
    body?.result?.charge,
    body?.result?.delivery_charge,
  ];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value >= 0) return value;
  }

  return null;
}

async function requestRate(destination: string) {
  const query = new URLSearchParams({
    creation: ORIGIN_BRANCH,
    destination,
    type: DELIVERY_TYPE,
  }).toString();

  const errors: string[] = [];

  for (const base of NCM_RATE_BASES) {
    const url = base + "/api/v1/shipping-rate?" + query;

    try {
      const response = await ncmFetch(url);
      const bodyText = await response.text();

      let body: any = {};
      try {
        body = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        throw new Error(
          "NCM returned a non-JSON rate response (HTTP " + response.status + ")",
        );
      }

      if (!response.ok) {
        const message = body?.Error ||
          body?.message ||
          body?.detail ||
          ("NCM API error (" + response.status + ")");
        throw new Error(
          "NCM API error (" + response.status + "): " +
            (typeof message === "string" ? message : JSON.stringify(message)),
        );
      }

      const charge = extractCharge(body);
      if (charge === null) {
        throw new Error(
          "NCM returned a rate response without a delivery charge",
        );
      }

      return { body, charge, url };
    } catch (error) {
      errors.push(
        base + "/api/v1/shipping-rate: " +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  throw new Error("NCM shipping-rate service unavailable. " + errors.join(" | "));
}

async function getRate(destination: string) {
  const key = destination.trim().toUpperCase();

  const { data: cached, error: cacheError } = await admin
    .from("ncm_delivery_rate_cache")
    .select(
      "origin_branch,destination_branch,delivery_type,ncm_charge,door_pickup_charge,fetched_at,expires_at",
    )
    .eq("origin_branch", ORIGIN_BRANCH)
    .eq("destination_branch", key)
    .eq("delivery_type", DELIVERY_TYPE)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (cacheError) throw cacheError;
  if (cached) return cached;

  const result = await requestRate(destination);
  const now = new Date();
  const expires = new Date(now.getTime() + CACHE_TTL_MS);

  const row = {
    origin_branch: ORIGIN_BRANCH,
    destination_branch: key,
    delivery_type: DELIVERY_TYPE,
    ncm_charge: Math.round(result.charge * 100) / 100,
    door_pickup_charge: DOOR_PICKUP_CHARGE,
    fetched_at: now.toISOString(),
    expires_at: expires.toISOString(),
    raw_response: result.body,
  };

  const { error } = await admin
    .from("ncm_delivery_rate_cache")
    .upsert(row, {
      onConflict: "origin_branch,destination_branch,delivery_type",
    });

  if (error) throw error;
  return row;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" });
  }

  try {
    if (!NCM_TOKEN) {
      return json({
        ok: false,
        error: "NCM delivery service is not configured yet. Please contact Suru Collection support.",
      });
    }

    const body = await req.json().catch(() => ({}));
    const destination = String(body?.destinationBranch || "").trim();

    if (!destination) {
      return json({
        ok: false,
        error: "Please select an NCM destination branch.",
      });
    }

    const rate = await getRate(destination);
    const ncmCharge = Number(rate.ncm_charge);
    const doorPickup = Number(rate.door_pickup_charge || DOOR_PICKUP_CHARGE);

    return json({
      ok: true,
      originBranch: ORIGIN_BRANCH,
      destinationBranch: rate.destination_branch,
      deliveryType: DELIVERY_TYPE,
      ncmDeliveryCharge: ncmCharge,
      doorPickupCharge: doorPickup,
      advanceDeliveryCharge: Math.round((ncmCharge + doorPickup) * 100) / 100,
      fetchedAt: rate.fetched_at,
      expiresAt: rate.expires_at,
    });
  } catch (error) {
    console.error(
      "NCM rate request failed:",
      error instanceof Error ? error.message : String(error),
    );

    return json({
      ok: false,
      error: error instanceof Error
        ? error.message
        : "Unable to calculate the NCM delivery charge right now. Please try again.",
    });
  }
});
