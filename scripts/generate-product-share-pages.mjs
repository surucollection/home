import fs from "node:fs/promises";
import path from "node:path";

const API = "https://vkycraymxhkqxgpcpdzw.supabase.co/rest/v1/";
const KEY = "sb_publishable_IUD5XQOsqHtrGCj3BJ5jpA_EjSPTUrC";
const SITE = "https://suru.com.np";
const R2_HOST = "images.suru.com.np";
const OUTPUT = path.resolve("dist", "share");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character] || character));
}

async function fetchAll(table, params) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams(params);
    query.set("limit", String(pageSize));
    query.set("offset", String(offset));
    const response = await fetch(API + table + "?" + query.toString(), {
      headers: { apikey: KEY, Authorization: "Bearer " + KEY, Accept: "application/json" }
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(table + " request failed (" + response.status + "): " + detail);
    }
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error("Unexpected " + table + " response.");
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function isR2Url(value) {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol === "https:" && parsed.hostname === R2_HOST && parsed.pathname.startsWith("/products/");
  } catch {
    return false;
  }
}

function imageType(value) {
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    if (pathname.endsWith(".png")) return "image/png";
    if (pathname.endsWith(".webp")) return "image/webp";
    if (pathname.endsWith(".avif")) return "image/avif";
    if (pathname.endsWith(".gif")) return "image/gif";
  } catch {}
  return "image/jpeg";
}

function renderPage(product, image) {
  const code = String(product.product_code).trim().toUpperCase();
  const productUrl = SITE + "/product.html?code=" + encodeURIComponent(code);
  const title = String(product.name || "Suru Collection");
  const price = Number(product.price || 0);
  const priceText = Number.isFinite(price) && price > 0
    ? "NPR " + price.toLocaleString("en-IN")
    : "";
  const description = String(product.description || [title, priceText, "Shop at Suru Collection."].filter(Boolean).join(" — ")).slice(0, 300);
  const shareTitle = title + (priceText ? " — " + priceText : "");
  const encodedProductUrl = escapeHtml(productUrl);
  const encodedImage = escapeHtml(image?.image_url || "");
  const imageMeta = image ? [
    '<meta property="og:image" content="' + encodedImage + '">',
    '<meta property="og:image:secure_url" content="' + encodedImage + '">',
    '<meta property="og:image:type" content="' + imageType(image.image_url) + '">',
    '<meta property="og:image:alt" content="' + escapeHtml(image.alt_text || title) + '">',
    '<meta name="twitter:image" content="' + encodedImage + '">'
  ].join("\n    ") : "";

  return '<!doctype html>\n<html lang="en">\n<head>\n'
    + '  <meta charset="utf-8">\n'
    + '  <meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + '  <title>' + escapeHtml(shareTitle) + ' | Suru Collection</title>\n'
    + '  <meta name="description" content="' + escapeHtml(description) + '">\n'
    + '  <link rel="canonical" href="' + encodedProductUrl + '">\n'
    + '  <meta property="og:site_name" content="Suru Collection">\n'
    + '  <meta property="og:type" content="product">\n'
    + '  <meta property="og:title" content="' + escapeHtml(shareTitle) + '">\n'
    + '  <meta property="og:description" content="' + escapeHtml(description) + '">\n'
    + '  <meta property="og:url" content="' + encodedProductUrl + '">\n'
    + (imageMeta ? "  " + imageMeta + "\n" : "")
    + '  <meta name="twitter:card" content="summary_large_image">\n'
    + '  <meta name="twitter:title" content="' + escapeHtml(shareTitle) + '">\n'
    + '  <meta name="twitter:description" content="' + escapeHtml(description) + '">\n'
    + '  <meta http-equiv="refresh" content="0;url=' + encodedProductUrl + '">\n'
    + '</head>\n<body>\n'
    + '  <main><h1>' + escapeHtml(title) + '</h1>'
    + (priceText ? '<p>' + escapeHtml(priceText) + '</p>' : "")
    + (image ? '<img src="' + encodedImage + '" alt="' + escapeHtml(image.alt_text || title) + '" style="max-width:100%;height:auto">' : "")
    + '<p><a href="' + encodedProductUrl + '">Open this product on Suru Collection</a></p></main>\n'
    + '  <script>window.location.replace(' + JSON.stringify(productUrl) + ');</script>\n'
    + '</body>\n</html>\n';
}

async function main() {
  const [products, images] = await Promise.all([
    fetchAll("products", {
      select: "id,product_code,name,description,price,is_active",
      is_active: "eq.true",
      order: "product_code.asc"
    }),
    fetchAll("product_images", {
      select: "product_id,image_url,alt_text,is_main,sort_order,created_at,media_type",
      media_type: "eq.image",
      order: "is_main.desc,sort_order.asc,created_at.asc"
    })
  ]);

  const imagesByProduct = new Map();
  for (const image of images) {
    if (!isR2Url(image.image_url)) continue;
    const list = imagesByProduct.get(image.product_id) || [];
    list.push(image);
    imagesByProduct.set(image.product_id, list);
  }

  await fs.rm(OUTPUT, { recursive: true, force: true });
  let written = 0;
  let missingImages = 0;
  for (const product of products) {
    const code = String(product.product_code || "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{1,40}$/.test(code)) continue;
    const options = imagesByProduct.get(product.id) || [];
    options.sort((a, b) => {
      if (Boolean(a.is_main) !== Boolean(b.is_main)) return a.is_main ? -1 : 1;
      const order = Number(a.sort_order || 0) - Number(b.sort_order || 0);
      if (order) return order;
      return String(a.created_at || "").localeCompare(String(b.created_at || ""));
    });
    const image = options[0] || null;
    if (!image) missingImages += 1;
    const directory = path.join(OUTPUT, code);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "index.html"), renderPage(product, image), "utf8");
    written += 1;
  }

  if (!written) throw new Error("No product share pages were generated.");
  console.log("Generated " + written + " static product share pages from Supabase; " + missingImages + " had no public R2 image.");
}

main().catch((error) => {
  console.error("Product share page generation failed:", error);
  process.exitCode = 1;
});
