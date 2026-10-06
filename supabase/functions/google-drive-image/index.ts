import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function response(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { ...cors, ...headers } });
}

function driveUrls(id, width) {
  const encoded = encodeURIComponent(id);
  const sz = Math.max(240, Math.min(2000, Math.round(Number(width) || 1200)));
  return [
    "https://drive.google.com/thumbnail?id=" + encoded + "&sz=w" + sz,
    "https://drive.google.com/uc?export=view&id=" + encoded,
    "https://drive.google.com/uc?export=download&id=" + encoded,
  ];
}

async function returnImage(upstream) {
  const type = String(upstream.headers.get("content-type") || "").toLowerCase();
  if (!upstream.ok || !type.startsWith("image/")) return null;
  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      "Content-Disposition": "inline",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return response("GET required.", 405, { "Content-Type": "text/plain" });

  const params = new URL(req.url).searchParams;
  const id = params.get("id")?.trim();
  const width = params.get("w") || "1200";

  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
    return response("Invalid Drive file ID.", 400, { "Content-Type": "text/plain" });
  }

  const apiKey = Deno.env.get("GOOGLE_DRIVE_API_KEY");

  if (apiKey) {
    try {
      const metaUrl = new URL("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id));
      metaUrl.searchParams.set("fields", "mimeType,name,thumbnailLink");
      metaUrl.searchParams.set("key", apiKey);
      const metaResponse = await fetch(metaUrl.toString());
      const meta = await metaResponse.json().catch(() => ({}));

      if (metaResponse.ok && String(meta.mimeType || "").toLowerCase().startsWith("image/")) {
        if (meta.thumbnailLink) {
          const thumbnail = await returnImage(await fetch(meta.thumbnailLink, { redirect: "follow" }));
          if (thumbnail) return thumbnail;
        }

        const mediaUrl = new URL("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id));
        mediaUrl.searchParams.set("alt", "media");
        mediaUrl.searchParams.set("key", apiKey);
        const original = await returnImage(await fetch(mediaUrl.toString()));
        if (original) return original;
      }
    } catch (_) {}
  }

  try {
    const headers = { "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" };
    for (const url of driveUrls(id, width)) {
      const image = await returnImage(await fetch(url, { redirect: "follow", headers }));
      if (image) return image;
    }
    return response("Unable to load Google Drive image. Check that the Drive file is shared and accessible.", 502, { "Content-Type": "text/plain" });
  } catch (e) {
    return response(e?.message || "Unable to load Google Drive image.", 502, { "Content-Type": "text/plain" });
  }
});
