import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ROOT = "1zeVIdGtmBCianwPQsGxwOkXnqclLapNh";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const ub64 = (s: string) => b64url(new TextEncoder().encode(s));

function der(pem: string) {
  const n = pem.replace(/\\\\n/g, "\n").replace(/\\\\r/g, "\r");
  const clean = n.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const raw = atob(clean);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function token() {
  const email = Deno.env.get("GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL")?.trim();
  const pk = Deno.env.get("GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY")?.trim();
  if (!email || !pk) throw new Error("Google Drive service-account secrets are not configured.");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = ub64(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." +
    ub64(JSON.stringify({ iss: email, scope: DRIVE_SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const key = await crypto.subtle.importKey("pkcs8", der(pk), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + b64url(new Uint8Array(sig)) })
  });
  const p = await r.json().catch(() => ({}));
  if (!r.ok || !p.access_token) throw new Error("Google authorization failed.");
  return p.access_token as string;
}

async function driveJson(t: string, path: string, init: RequestInit = {}) {
  const h = new Headers(init.headers);
  h.set("Authorization", "Bearer " + t);
  const r = await fetch(DRIVE_API + path, { ...init, headers: h });
  const p = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(String(p?.error?.message || "Google Drive request failed."));
  return p;
}

async function findFolder(t: string, code: string) {
  const q = "'" + ROOT + "' in parents and name = '" + code.replace(/'/g, "\\'") + "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  const p = await driveJson(t, "/files?" + new URLSearchParams({
    q, fields: "files(id,name)", pageSize: "10", supportsAllDrives: "true", includeItemsFromAllDrives: "true"
  }));
  return p.files?.[0]?.id || "";
}

async function processedFolder(t: string, parent: string) {
  const q = "'" + parent + "' in parents and name = 'Processed' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  const p = await driveJson(t, "/files?" + new URLSearchParams({ q, fields: "files(id,name)", pageSize: "10", supportsAllDrives: "true", includeItemsFromAllDrives: "true" }));
  if (p.files?.[0]?.id) return p.files[0].id;
  const created = await driveJson(t, "/files?supportsAllDrives=true", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Processed", mimeType: "application/vnd.google-apps.folder", parents: [parent] })
  });
  return created.id;
}

async function upload(t: string, folder: string, name: string, mime: string, bytes: ArrayBuffer) {
  const boundary = "suru_" + crypto.randomUUID().replace(/-/g, "");
  const metadata = JSON.stringify({ name, parents: [folder] });
  const enc = new TextEncoder();
  const a = enc.encode("--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + metadata + "\r\n--" + boundary + "\r\nContent-Type: " + mime + "\r\n\r\n");
  const b = enc.encode("\r\n--" + boundary + "--\r\n");
  const file = new Uint8Array(bytes);
  const all = new Uint8Array(a.length + file.length + b.length);
  all.set(a); all.set(file, a.length); all.set(b, a.length + file.length);
  const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true", {
    method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "multipart/related; boundary=" + boundary }, body: all
  });
  const p = await r.json().catch(() => ({}));
  if (!r.ok || !p.id) throw new Error(String(p?.error?.message || "Processed image upload failed."));
  return p.id as string;
}

function dimensions(bytes: Uint8Array) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { width: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16), height: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(20) };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1]; i += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (i + 2 > bytes.length) break;
      const len = (bytes[i] << 8) | bytes[i + 1];
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && i + 7 < bytes.length)
        return { height: (bytes[i+3] << 8) | bytes[i+4], width: (bytes[i+5] << 8) | bytes[i+6] };
      i += len;
    }
  }
  return null;
}

async function pixel(apiKey: string, path: string, bytes: ArrayBuffer, mime: string, filename: string, fields: Record<string,string> = {}) {
  const form = new FormData();
  form.append("image", new File([bytes], filename, { type: mime }));
  for (const [k,v] of Object.entries(fields)) form.append(k, v);
  const r = await fetch("https://api.pixelapi.dev" + path, {
    method: "POST", headers: { Authorization: "Bearer " + apiKey, "User-Agent": "SuruCollection/1.0" }, body: form
  });
  const p = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(String(p?.error || p?.message || "Image processor request failed."));
  const id = p.generation_id || p.id;
  if (!id) throw new Error("Image processor did not return a job id.");
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2500));
    const s = await fetch("https://api.pixelapi.dev/v1/image/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + apiKey, "User-Agent": "SuruCollection/1.0" } });
    const x = await s.json().catch(() => ({}));
    if (x.status === "completed" && x.output_url) {
      const out = await fetch(x.output_url);
      if (!out.ok) throw new Error("Processed image download failed.");
      return { bytes: await out.arrayBuffer(), mime: out.headers.get("content-type") || "image/jpeg" };
    }
    if (x.status === "failed" || x.status === "blocked") throw new Error(String(x.error || "Image processor failed."));
  }
  throw new Error("Image processor timed out.");
}

Deno.serve(async req => {
  if (req.method !== "POST") return json({ message: "POST required." }, 405);
  const sb = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
  const secret = req.headers.get("x-cron-secret") || "";
  const auth = await sb.rpc("verify_drive_sync_cron_secret", { p_secret: secret });
  if (auth.error || auth.data !== true) return json({ message: "Unauthorized." }, 401);
  const apiKey = Deno.env.get("PIXELAPI_KEY")?.trim();
  if (!apiKey) return json({ success: false, message: "PIXELAPI_KEY is not configured." }, 503);
  let job: any = null;
  try {
    const q = await sb.from("product_image_processing_jobs").select("*").eq("status","pending").order("created_at",{ascending:true}).limit(1).maybeSingle();
    if (q.error) throw q.error;
    job = q.data;
    if (!job) return json({ success: true, processed: 0, message: "No pending image jobs." });
    const claim = await sb.from("product_image_processing_jobs").update({ status:"processing", attempts:(job.attempts||0)+1, locked_at:new Date().toISOString(), last_error:null }).eq("id",job.id).eq("status","pending").select("*").maybeSingle();
    if (claim.error || !claim.data) return json({ success:true, processed:0, message:"Job was claimed by another worker." });
    job = claim.data;
    const sourceUrl = (Deno.env.get("SUPABASE_URL") || "") + "/functions/v1/google-drive-image?id=" + encodeURIComponent(job.source_file_id);
    const src = await fetch(sourceUrl);
    if (!src.ok) throw new Error("Original Drive image could not be downloaded.");
    const srcBytes = await src.arrayBuffer();
    const srcMime = src.headers.get("content-type") || job.source_mime_type || "image/jpeg";
    const d = dimensions(new Uint8Array(srcBytes));
    let result = await pixel(apiKey, "/v1/image/remove-object", srcBytes, srcMime, job.source_file_name || "source.jpg", { prompt: "remove visible watermark, logo, copyright text, seller mark, or other text overlay while preserving the clothing/product, fabric texture, colors, pattern, embroidery, and background naturally" });
    const rd = dimensions(new Uint8Array(result.bytes));
    if ((d && Math.min(d.width,d.height) < 1200) || (rd && Math.min(rd.width,rd.height) < 1200)) {
      result = await pixel(apiKey, "/v1/image/upscale", result.bytes, result.mime, "cleaned-" + (job.source_file_name || "image.jpg"), { scale: "2" });
    }
    const t = await token();
    const folder = await findFolder(t, job.product_code);
    if (!folder) throw new Error("Product Drive folder not found: " + job.product_code);
    const pf = await processedFolder(t, folder);
    const filename = "processed-" + String(job.source_file_name || "image").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,150) + ".jpg";
    const fileId = await upload(t, pf, filename, "image/jpeg", result.bytes);
    const processedUrl = (Deno.env.get("SUPABASE_URL") || "") + "/functions/v1/google-drive-image?id=" + encodeURIComponent(fileId);
    const pi = await sb.from("product_images").update({ image_url: processedUrl }).eq("product_id",job.product_id).eq("image_url",sourceUrl);
    if (pi.error) throw pi.error;
    const done = await sb.from("product_image_processing_jobs").update({ status:"completed", processed_file_id:fileId, processed_image_url:processedUrl, completed_at:new Date().toISOString(), locked_at:null, last_error:null }).eq("id",job.id);
    if (done.error) throw done.error;
    return json({ success:true, processed:1, product_code:job.product_code, source_file_id:job.source_file_id, processed_file_id:fileId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Image processing failed.";
    if (job?.id) await sb.from("product_image_processing_jobs").update({ status:"failed", last_error:message.slice(0,500), locked_at:null }).eq("id",job.id);
    return json({ success:false, message }, 502);
  }
});