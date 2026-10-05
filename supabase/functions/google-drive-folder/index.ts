import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ROOT_FOLDER_ID = "1zeVIdGtmBCianwPQsGxwOkXnqclLapNh";
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
  if (userError || !userData?.user) return json({ message: "Your session is not valid." }, 401);

  const { data: admin } = await supabase
    .from("admin_users")
    .select("id,role,is_active")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!admin?.is_active || !["admin", "manager"].includes(admin.role)) {
    return json({ message: "Admin access required." }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const apiKey = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!apiKey) return json({ message: "GOOGLE_DRIVE_API_KEY is not configured." }, 503);

  let folderId = "";
  const suppliedUrl = String(body.folder_url || "").trim();
  if (suppliedUrl) {
    const match =
      suppliedUrl.match(/drive\.google\.com\/drive\/folders\/([^/?#]+)/i) ||
      suppliedUrl.match(/[?&]id=([^&#]+)/i);
    folderId = match?.[1] || "";
  }

  const productCode = String(body.product_code || "").trim().toUpperCase();

  if (!folderId && productCode) {
    const escapedCode = productCode.replace(/'/g, "\\'");
    const driveQuery =
      "'" + ROOT_FOLDER_ID + "' in parents and name = '" + escapedCode +
      "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";

    const searchUrl = new URL("https://www.googleapis.com/drive/v3/files");
    searchUrl.searchParams.set("q", driveQuery);
    searchUrl.searchParams.set("fields", "files(id,name,mimeType,createdTime,parents)");
    searchUrl.searchParams.set("pageSize", "10");
    searchUrl.searchParams.set("orderBy", "createdTime");
    searchUrl.searchParams.set("supportsAllDrives", "true");
    searchUrl.searchParams.set("includeItemsFromAllDrives", "true");
    searchUrl.searchParams.set("key", apiKey);

    const response = await fetch(searchUrl.toString());
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return json({ message: payload?.error?.message || "Google Drive folder lookup failed." }, 502);
    }

    const matches = (payload.files || []).filter(
      (file: any) => String(file.name || "").trim().toUpperCase() === productCode
    );

    if (matches.length > 1) {
      return json({
        message: "Multiple Google Drive folders named " + productCode +
          " were found inside the Suru Collection root folder."
      }, 409);
    }

    folderId = matches[0]?.id || "";

    if (!folderId) {
      return json({
        files: [],
        count: 0,
        product_code: productCode,
        folder_found: false,
        message: "No Google Drive folder named " + productCode +
          " was found inside the Suru Collection root folder."
      });
    }
  }

  if (!folderId) {
    return json({ message: "Provide product_code or a valid Google Drive folder URL." }, 400);
  }

  const files: any[] = [];
  const seenIds = new Set<string>();
  let pageToken = "";

  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", "'" + folderId + "' in parents and trashed = false");
    url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,createdTime)");
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("orderBy", "createdTime");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url.toString());
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return json({ message: payload?.error?.message || "Google Drive API request failed." }, 502);
    }

    for (const file of payload.files || []) {
      if (
        !file?.id ||
        seenIds.has(file.id) ||
        !String(file.mimeType || "").toLowerCase().startsWith("image/")
      ) continue;

      seenIds.add(file.id);
      files.push({
        id: file.id,
        name: file.name || "Drive image",
        mimeType: file.mimeType,
        url:
          "https://vkycraymxhkqxgpcpdzw.supabase.co/functions/v1/google-drive-image?id=" +
          encodeURIComponent(file.id) + "&w=1600",
        createdTime: file.createdTime || null
      });
    }

    pageToken = payload.nextPageToken || "";
  } while (pageToken);

  files.sort((a, b) =>
    String(a.createdTime || "").localeCompare(String(b.createdTime || ""))
  );

  return json({
    files,
    count: files.length,
    product_code: productCode || null,
    folder_id: folderId,
    folder_found: true,
    message: files.length
      ? files.length + " image file" + (files.length === 1 ? "" : "s") + " found in Google Drive."
      : "No image files were found."
  });
});
