import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

async function db(path: string, init: RequestInit = {}) {
  return fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: "Bearer " + SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function getAuthenticatedUser(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const r = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: "Bearer " + token },
  });
  if (!r.ok) return null;
  return await r.json();
}

async function requireAdmin(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user?.id) throw new Error("Unauthorized");
  const r = await db("admin_users?id=eq." + encodeURIComponent(user.id) + "&is_active=eq.true&select=id,role");
  if (!r.ok) throw new Error("Unable to verify administrator");
  const rows = await r.json();
  if (!rows?.length || !["admin", "manager"].includes(rows[0].role)) {
    throw new Error("Administrator access required");
  }
  return user;
}

async function authAdmin(path: string, init: RequestInit = {}) {
  return fetch(SUPABASE_URL + "/auth/v1/admin/" + path, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: "Bearer " + SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    await requireAdmin(req);
    const body = await req.json();
    const action = body.action;

    if (action === "update_customer") {
      const customerId = String(body.customer_id || "").trim();
      if (!customerId) throw new Error("Customer ID is required");

      const fields: Record<string, unknown> = {
        name: String(body.name || "").trim(),
        first_name: String(body.first_name || "").trim(),
        last_name: String(body.last_name || "").trim(),
        phone: String(body.phone || "").trim(),
        email: String(body.email || "").trim().toLowerCase(),
        address: body.address === undefined ? null : String(body.address || "").trim(),
        city: body.city === undefined ? null : String(body.city || "").trim(),
        district: body.district === undefined ? null : String(body.district || "").trim(),
        province: body.province === undefined ? null : String(body.province || "").trim(),
        postal_code: body.postal_code === undefined ? null : (String(body.postal_code || "").trim() || null),
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!fields.name || !fields.first_name || !fields.last_name || !fields.phone || !fields.email) {
        throw new Error("Name, email and phone are required");
      }

      const existing = await db("customers?id=eq." + encodeURIComponent(customerId) + "&select=*");
      if (!existing.ok) throw new Error("Unable to load customer");
      const rows = await existing.json();
      const customer = rows?.[0];
      if (!customer) throw new Error("Customer not found");

      for (const key of ["address","city","district","province","postal_code"]) {
        if (fields[key as keyof typeof fields] === null) fields[key as keyof typeof fields] = customer[key] ?? null;
      }

      if (customer.auth_user_id) {
        const authPatch: Record<string, unknown> = {
          email: fields.email,
          user_metadata: {
            name: fields.name,
            first_name: fields.first_name,
            last_name: fields.last_name,
            phone: fields.phone,
            address: fields.address,
            city: fields.city,
            district: fields.district,
            province: fields.province,
            postal_code: fields.postal_code,
          },
        };
        const ar = await authAdmin("users/" + String(customer.auth_user_id), {
          method: "PUT",
          body: JSON.stringify(authPatch),
        });
        if (!ar.ok) {
          const t = await ar.text();
          throw new Error("Unable to update login account: " + t);
        }
      }

      const cr = await db("customers?id=eq." + encodeURIComponent(customerId), {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(fields),
      });
      if (!cr.ok) throw new Error(await cr.text());
      return json({ success: true, customer: (await cr.json())?.[0] || null });
    }

    if (action === "set_password") {
      const customerId = String(body.customer_id || "").trim();
      const password = String(body.password || "");
      if (!customerId || password.length < 6) throw new Error("Customer ID and a password of at least 6 characters are required");

      const lookup = await db("rpc/admin_customer_auth_lookup", {
        method: "POST",
        body: JSON.stringify({ p_customer_id: customerId }),
      });
      if (!lookup.ok) throw new Error("Unable to load customer login link: " + await lookup.text());
      const authUserId = await lookup.json();
      if (!authUserId) throw new Error("This customer does not have a login account");

      const ar = await authAdmin("users/" + String(authUserId), {
        method: "PUT",
        body: JSON.stringify({ password }),
      });
      if (!ar.ok) throw new Error("Unable to reset password: " + await ar.text());
      return json({ success: true, message: "Customer password updated successfully." });
    }

    throw new Error("Unknown action");
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});