export const money = (value) =>
  "NPR " + Math.round(Number(value || 0)).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });

export const cleanPhone = (value) =>
  String(value || "").trim().replace(/[\s()-]/g, "");

export function normalizeNepalPhone(value) {
  const raw = cleanPhone(value);
  if (raw.startsWith("+977")) return raw;
  if (raw.startsWith("977")) return "+" + raw;
  if (raw.startsWith("0")) return "+977" + raw.slice(1);
  return "+977" + raw;
}

export const isNepalMobile = (value) => /^\+9779\d{9}$/.test(normalizeNepalPhone(value));

export const imageUrl = (url, width = 720) => {
  const value = String(url || "").trim();
  const driveFile =
    value.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i) ||
    value.match(/[?&]id=([^&#]+)/i);
  if (driveFile?.[1] && /drive\.google\.com/i.test(value)) {
    return "https://vkycraymxhkqxgpcpdzw.supabase.co/functions/v1/google-drive-image?id=" +
      encodeURIComponent(driveFile[1]) + "&w=" + Math.max(240, Math.round(width)) + "&v=6";
  }
  if (/\/functions\/v1\/google-drive-image(?:\?|$)/i.test(value)) {
    try {
      const parsed = new URL(value);
      const id = parsed.searchParams.get("id");
      if (id) {
        parsed.searchParams.set("w", String(Math.max(240, Math.round(width))));
        parsed.searchParams.set("v", "6");
        return parsed.toString();
      }
    } catch {}
  }
  const marker = "/upload/";
  const index = value.indexOf(marker);
  if (value.includes("res.cloudinary.com") && index >= 0) {
    const rest = value.slice(index + marker.length);
    if (!/^f_auto,q_auto,w_\d+/.test(rest)) {
      return value.slice(0, index + marker.length) +
        "f_auto,q_auto,w_" + Math.max(160, Math.round(width)) + ",c_limit/" + rest;
    }
  }
  return value;
};

export const randomIdempotencyKey = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
};

export const canonicalProvince = (value) => {
  const v = String(value || "").trim();
  const map = {
    "koshi": "Koshi Province",
    "madhesh": "Madhesh Province",
    "bagmati": "Bagmati Province",
    "gandaki": "Gandaki Province",
    "lumbini": "Lumbini Province",
    "karnali": "Karnali Province",
    "sudurpaschim": "Sudurpashchim Province",
    "sudurpashchim": "Sudurpashchim Province"
  };
  return map[v.toLowerCase()] || v;
};

export const provinces = [
  "Koshi Province",
  "Madhesh Province",
  "Bagmati Province",
  "Gandaki Province",
  "Lumbini Province",
  "Karnali Province",
  "Sudurpashchim Province"
];