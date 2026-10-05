import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ROOT_FOLDER_ID = "1zeVIdGtmBCianwPQsGxwOkXnqclLapNh";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

const cors = {
  "Access-Control-Allow-Origin": "https://suru.com.np",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" }
  });

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const utf8Base64Url = (value: string) =>
  base64Url(new TextEncoder().encode(value));

function pemToDer(pem: string) {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(clean);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getGoogleAccessToken() {
  const email = Deno.env.get("GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL")?.trim();
  const privateKey = Deno.env.get("GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY")?.trim();

  if (!email || !privateKey) {
    throw new Error("Google Drive service-account secrets are not configured.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = utf8Base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = utf8Base64Url(JSON.stringify({
    iss: email,
    scope: DRIVE_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const unsigned = header + "." + claim;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );

  const assertion = unsigned + "." + base64Url(new Uint8Array(signature));

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error("Google authorization failed.");
  }

  return payload.access_token as string;
}

async function driveRequest(
  accessToken: string,
  path: string,
  init: RequestInit = {}
) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", "Bearer " + accessToken);
  const response = await fetch(DRIVE_API + path, { ...init, headers });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : "Google Drive request failed."
    );
  }

  return payload;
}

async function findProductFolder(accessToken: string, productCode: string) {
  const escaped = productCode.replace(/'/g, "\\'");
  const q =
    "'" + ROOT_FOLDER_ID + "' in parents and name = '" + escaped +
    "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";

  const params = new URLSearchParams({
    q,
    fields: "files(id,name,mimeType,createdTime)",
    pageSize: "10",
    orderBy: "createdTime",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true"
  });

  const payload = await driveRequest(
    accessToken,
    "/files?" + params.toString()
  );

  const matches = (payload.files || []).filter(
    (file: any) =>
      String(file?.name || "").trim().toUpperCase() === productCode
  );

  if (matches.length > 1) {
    throw new Error("Multiple product folders with this code were found.");
  }

  return matches[0]?.id || "";
}

async function findOrCreateProcessedFolder(
  accessToken: string,
  productFolderId: string
) {
  const q =
    "'" + productFolderId + "' in parents and name = 'Processed'" +
    " and mimeType = 'application/vnd.google-apps.folder' and trashed = false";

  const params = new URLSearchParams({
    q,
    fields: "files(id,name,mimeType)",
    pageSize: "10",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true"
  });

  const existing = await driveRequest(
    accessToken,
    "/files?" + params.toString()
  );

  if (existing.files?.length) return existing.files[0].id as string;

  const created = await driveRequest(accessToken, "/files?supportsAllDrives=true", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Processed",
      mimeType: "application/vnd.google-apps.folder",
      parents: [productFolderId]
    })
  });

  return created.id as string;
}

async function uploadFile(
  accessToken: string,
  folderId: string,
  filename: string,
  mimeType: string,
  bytes: ArrayBuffer
) {
  const safeName = filename
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, "_")
    .trim()
    .slice(0, 180) || "processed-image";

  const boundary = "suru_drive_" + crypto.randomUUID().replace(/-/g, "");
  const metadata = JSON.stringify({
    name: safeName,
    parents: [folderId]
  });

  const encoder = new TextEncoder();
  const prefix =
    "--" + boundary + "\r\n" +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    metadata + "\r\n" +
    "--" + boundary + "\r\n" +
    "Content-Type: " + mimeType + "\r\n\r\n";

  const suffix = "\r\n--" + boundary + "--\r\n";
  const prefixBytes = encoder.encode(prefix);
  const suffixBytes = encoder.encode(suffix);
  const fileBytes = new Uint8Array(bytes);
  const combined = new Uint8Array(
    prefixBytes.length + fileBytes.length + suffixBytes.length
  );

  combined.set(prefixBytes, 0);
  combined.set(fileBytes, prefixBytes.length);
  combined.set(suffixBytes, prefixBytes.length + fileBytes.length);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + accessToken,
        "Content-Type": "multipart/related; boundary=" + boundary
      },
      body: combined
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.id) {
    throw new Error(
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : "Processed image upload failed."
    );
  }

  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ message: "POST required." }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ message: "Authentication required." }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    { global: { headers: { Authorization: auth } } }
  );

  const token = auth.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return json({ message: "Your session is not valid." }, 401);
  }

  const { data: admin } = await supabase
    .from("admin_users")
    .select("id,role,is_active")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!admin?.is_active || !["admin", "manager"].includes(admin.role)) {
    return json({ message: "Admin access required." }, 403);
  }

  try {
    const form = await req.formData();
    const productCode = String(form.get("product_code") || "").trim().toUpperCase();
    const requestedName = String(form.get("filename") || "").trim();
    const file = form.get("file");

    if (!/^[A-Z0-9_-]{1,64}$/.test(productCode)) {
      return json({ message: "A valid product code is required." }, 400);
    }

    if (!(file instanceof File)) {
      return json({ message: "A processed image file is required." }, 400);
    }

    if (!String(file.type || "").toLowerCase().startsWith("image/")) {
      return json({ message: "Only image files are accepted." }, 400);
    }

    if (file.size <= 0 || file.size > 15 * 1024 * 1024) {
      return json({ message: "Processed image must be between 1 byte and 15 MB." }, 400);
    }

    const accessToken = await getGoogleAccessToken();
    const productFolderId = await findProductFolder(accessToken, productCode);

    if (!productFolderId) {
      return json({
        message: "No Google Drive product folder named " + productCode + " was found inside the Suru Collection root folder."
      }, 404);
    }

    const processedFolderId = await findOrCreateProcessedFolder(
      accessToken,
      productFolderId
    );

    const filename =
      requestedName ||
      ("processed-" + productCode.toLowerCase() + "-" + Date.now() + ".jpg");

    const uploaded = await uploadFile(
      accessToken,
      processedFolderId,
      filename,
      file.type || "image/jpeg",
      await file.arrayBuffer()
    );

    return json({
      success: true,
      product_code: productCode,
      processed_folder_id: processedFolderId,
      processed_file_id: uploaded.id,
      name: uploaded.name || filename
    });
  } catch (error) {
    console.error("google-drive-processed-upload:", error);
    return json({
      message: error instanceof Error ? error.message : "Processed image upload failed."
    }, 502);
  }
});
