import { supabase } from "./api.js";

export const CYBERSOURCE_ENABLED =
  String(import.meta.env.VITE_CYBERSOURCE_ENABLED || "").toLowerCase() === "true";

const SDK_CACHE = new Map();

export async function createCyberSourceSession(orderId) {
  if (!CYBERSOURCE_ENABLED) {
    throw new Error("Card / Payment Gateway is not enabled yet.");
  }
  const id = String(orderId || "").trim();
  if (!id) throw new Error("Payment order ID is missing.");

  const { data, error } = await supabase.functions.invoke("cybersource-session", {
    body: { orderId: id },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  if (!data?.sessionJwt) {
    throw new Error("CyberSource secure payment session was not returned.");
  }
  return data;
}

export function loadCyberSourceLibrary(src, integrity) {
  const url = String(src || "").trim();
  if (!/^https:\\/\\//i.test(url)) {
    throw new Error("CyberSource payment library URL is invalid.");
  }
  const key = url + "|" + String(integrity || "");
  if (SDK_CACHE.has(key)) return SDK_CACHE.get(key);

  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-suru-cybersource="1"]');
    if (existing) {
      if (window.VAS?.UnifiedCheckout) return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("CyberSource payment library could not be loaded.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.suruCybersource = "1";
    if (integrity) {
      script.integrity = String(integrity);
      script.crossOrigin = "anonymous";
    }
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("CyberSource payment library could not be loaded."));
    document.head.appendChild(script);
  });

  SDK_CACHE.set(key, promise);
  return promise;
}
