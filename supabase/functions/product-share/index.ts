import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const FALLBACK_IMAGE = "https://suru.com.np/assets/suru-logo-official.png";
const PRODUCT_PAGE = "https://suru.com.np/product.html?code=";

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character] || character));
}

function publicApiKey(): string {
  const configured = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "";
  try {
    const mapping = JSON.parse(configured);
    const defaultKey = mapping?.default;
    if (defaultKey) {
      return Deno.env.get(defaultKey) || defaultKey;
    }
  } catch {
    // Fall through to the standard legacy environment variable.
  }
  return Deno.env.get("SUPABASE_ANON_KEY")
    || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")
    || "";
}

async function fetchRows(table: string, params: URLSearchParams, baseUrl: string, key: string) {
  const response = await fetch(baseUrl + "/rest/v1/" + table + "?" + params.toString(), {
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error("Product lookup failed with status " + response.status);
  }
  return await response.json();
}

function htmlResponse(body: string, status = 200, headOnly = false): Response {
  return new Response(headOnly ? null : body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { "Allow": "GET, HEAD" } });
  }

  const requestUrl = new URL(request.url);
  const rawCode = String(requestUrl.searchParams.get("code") || "").trim();
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(rawCode)) {
    return htmlResponse("<!doctype html><html><head><title>Product not found | Suru Collection</title></head><body><p>Invalid product link.</p><a href=\"https://suru.com.np/\">Visit Suru Collection</a></body></html>", 400, request.method === "HEAD");
  }

  const code = rawCode.toUpperCase();
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const key = publicApiKey();
  if (!supabaseUrl || !key) {
    return htmlResponse("<!doctype html><html><head><title>Suru Collection</title></head><body><a href=\"https://suru.com.np/\">Visit Suru Collection</a></body></html>", 503, request.method === "HEAD");
  }

  try {
    const productParams = new URLSearchParams({
      select: "id,product_code,name,description,price,slug",
      product_code: "eq." + code,
      is_active: "eq.true",
      limit: "1",
    });
    const products = await fetchRows("products", productParams, supabaseUrl, key);
    const product = Array.isArray(products) ? products[0] : null;
    if (!product) {
      return htmlResponse("<!doctype html><html><head><title>Product not found | Suru Collection</title></head><body><p>This product is no longer available.</p><a href=\"https://suru.com.np/products.html\">Browse Suru Collection</a></body></html>", 404, request.method === "HEAD");
    }

    const imageParams = new URLSearchParams({
      select: "image_url,alt_text,is_main,sort_order,media_type",
      product_id: "eq." + product.id,
      media_type: "eq.image",
      order: "is_main.desc,sort_order.asc,created_at.asc",
      limit: "1",
    });
    const images = await fetchRows("product_images", imageParams, supabaseUrl, key);
    const rawImage = Array.isArray(images) ? String(images[0]?.image_url || "") : "";
    let image = FALLBACK_IMAGE;
    try {
      if (rawImage && new URL(rawImage).protocol === "https:") image = rawImage;
    } catch {
      // Ignore invalid image URLs and use the brand fallback.
    }

    const productUrl = PRODUCT_PAGE + encodeURIComponent(code);
    const title = String(product.name || "Suru Collection");
    const price = Number(product.price || 0);
    const priceText = Number.isFinite(price) && price > 0 ? "NPR " + price.toLocaleString("en-IN") : "";
    const description = String(product.description || [title, priceText, "Shop at Suru Collection."].filter(Boolean).join(" — ")).slice(0, 300);
    const socialTitle = title + (priceText ? " — " + priceText : "");
    const imageAlt = String(images?.[0]?.alt_text || title);
    const html = "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
      + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
      + "<title>" + escapeHtml(socialTitle) + " | Suru Collection</title>"
      + "<meta name=\"description\" content=\"" + escapeHtml(description) + "\">"
      + "<link rel=\"canonical\" href=\"" + escapeHtml(productUrl) + "\">"
      + "<meta property=\"og:site_name\" content=\"Suru Collection\">"
      + "<meta property=\"og:type\" content=\"product\">"
      + "<meta property=\"og:title\" content=\"" + escapeHtml(socialTitle) + "\">"
      + "<meta property=\"og:description\" content=\"" + escapeHtml(description) + "\">"
      + "<meta property=\"og:url\" content=\"" + escapeHtml(productUrl) + "\">"
      + "<meta property=\"og:image\" content=\"" + escapeHtml(image) + "\">"
      + "<meta property=\"og:image:secure_url\" content=\"" + escapeHtml(image) + "\">"
      + "<meta property=\"og:image:alt\" content=\"" + escapeHtml(imageAlt) + "\">"
      + "<meta name=\"twitter:card\" content=\"summary_large_image\">"
      + "<meta name=\"twitter:title\" content=\"" + escapeHtml(socialTitle) + "\">"
      + "<meta name=\"twitter:description\" content=\"" + escapeHtml(description) + "\">"
      + "<meta name=\"twitter:image\" content=\"" + escapeHtml(image) + "\">"
      + "</head><body><main><img src=\"" + escapeHtml(image) + "\" alt=\"" + escapeHtml(imageAlt) + "\" style=\"max-width:100%;height:auto\">"
      + "<h1>" + escapeHtml(title) + "</h1><p>" + escapeHtml(description) + "</p>"
      + "<a href=\"" + escapeHtml(productUrl) + "\">View this product on Suru Collection</a></main>"
      + "<script>window.location.replace(" + JSON.stringify(productUrl) + ");</script></body></html>";

    return htmlResponse(html, 200, request.method === "HEAD");
  } catch (error) {
    console.error("product-share failed:", error);
    return htmlResponse("<!doctype html><html><head><title>Suru Collection</title></head><body><p>Unable to load this product preview right now.</p><a href=\"https://suru.com.np/products.html\">Browse Suru Collection</a></body></html>", 502, request.method === "HEAD");
  }
});
