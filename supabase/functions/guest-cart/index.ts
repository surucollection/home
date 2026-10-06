import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function validGuestId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{20,200}$/.test(value);
}

function validCart(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length <= 100;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const action = body?.action;
    const guestId = body?.guest_id;

    if (!validGuestId(guestId)) {
      return json({ error: "Invalid guest id" }, 400);
    }

    if (action === "get") {
      const { data, error } = await supabase
        .from("guest_carts")
        .select("cart, updated_at")
        .eq("guest_id", guestId)
        .maybeSingle();

      if (error) {
        console.error(error);
        return json({ error: "Unable to read cart" }, 500);
      }

      return json({
        cart: data?.cart ?? null,
        updated_at: data?.updated_at ?? null
      });
    }

    if (action === "save") {
      if (!validCart(body.cart)) {
        return json({ error: "Invalid cart" }, 400);
      }

      const { error } = await supabase
        .from("guest_carts")
        .upsert(
          {
            guest_id: guestId,
            cart: body.cart,
            updated_at: new Date().toISOString()
          },
          { onConflict: "guest_id" }
        );

      if (error) {
        console.error(error);
        return json({ error: "Unable to save cart" }, 500);
      }

      return json({ ok: true });
    }

    if (action === "delete") {
      const { error } = await supabase
        .from("guest_carts")
        .delete()
        .eq("guest_id", guestId);

      if (error) {
        console.error(error);
        return json({ error: "Unable to delete cart" }, 500);
      }

      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: "Invalid request" }, 400);
  }
});