import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import * as NativePasskeys from "react-native-passkeys";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

function getRedirectParts(url) {
  const parsed = new URL(url);
  const query = parsed.searchParams;
  const hash = new URLSearchParams(String(parsed.hash || "").replace(/^#/, ""));
  return { parsed, query, hash };
}

async function currentSessionOrNull() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data?.session?.user ? data : null;
}

function isAppAuthCallback(rawUrl) {
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl);
    return url.protocol === "suru:" &&
      ((url.hostname === "auth" && url.pathname.replace(/\\/$/, "") === "/callback") ||
       url.pathname.replace(/\\/$/, "") === "/auth/callback");
  } catch {
    return false;
  }
}

async function getAppCallback(callbackPromise, timeoutMs = 120000) {
  const initial = await Linking.getInitialURL().catch(() => null);
  if (isAppAuthCallback(initial)) return initial;
  return await Promise.race([
    callbackPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(
      "Google completed but iOS did not deliver the suru://auth/callback link. Confirm this exact redirect is allowlisted in Supabase Auth → URL Configuration."
    )), timeoutMs))
  ]);
}

export async function continueWithGoogle({ link = false } = {}) {
  // Keep this exact native URI registered in mobile/app.json and allowlisted
  // in Supabase Auth → URL Configuration → Redirect URLs.
  const redirectTo = "suru://auth/callback";
  const options = { redirectTo, skipBrowserRedirect: true };

  const { data, error } = link
    ? await supabase.auth.linkIdentity({ provider: "google", options })
    : await supabase.auth.signInWithOAuth({ provider: "google", options });
  if (error) throw error;
  if (!data?.url) {
    throw new Error("Google sign-in did not return an authorization URL. Check that Google is enabled in Supabase Auth.");
  }

  let resolveCallback;
  let rejectCallback;
  const callbackPromise = new Promise((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });
  const subscription = Linking.addEventListener("url", ({ url }) => {
    if (isAppAuthCallback(url)) resolveCallback(url);
  });

  try {
    // Use the browser sheet and explicitly capture the custom-scheme callback.
    // iOS may dismiss its browser UI before openAuthSessionAsync reports success;
    // the URL event is therefore the source of truth for the native hand-off.
    const browserPromise = WebBrowser.openBrowserAsync(data.url);
    browserPromise.catch(rejectCallback);

    const callbackUrl = await getAppCallback(callbackPromise);
    const { parsed, query, hash } = getRedirectParts(callbackUrl);
    if (parsed.protocol !== "suru:") {
      throw new Error("Google returned to an unexpected app link.");
    }

    const callbackError =
      query.get("error_description") || query.get("error") || query.get("error_code") ||
      hash.get("error_description") || hash.get("error") || hash.get("error_code");
    if (callbackError) throw new Error(callbackError);

    const code = query.get("code");
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        throw new Error("Google returned to Suru, but the authorization code could not be exchanged: " + exchangeError.message);
      }
    } else {
      const access_token = hash.get("access_token") || query.get("access_token");
      const refresh_token = hash.get("refresh_token") || query.get("refresh_token");
      if (!access_token || !refresh_token) {
        throw new Error("Google returned to Suru without an authorization code or session tokens.");
      }
      const { error: setError } = await supabase.auth.setSession({ access_token, refresh_token });
      if (setError) throw setError;
    }

    const activeSession = await currentSessionOrNull();
    if (!activeSession) {
      throw new Error("Google completed, but the Suru app did not store the signed-in session. Please try again.");
    }
    return activeSession;
  } finally {
    subscription.remove();
  }
}

export function isNativePasskeysSupported() {
  try { return NativePasskeys.isSupported(); } catch { return false; }
}

function friendlyPasskeyError(error) {
  const raw = String(error?.message || error || "Passkey operation could not be completed.");
  const lower = raw.toLowerCase();

  if (lower.includes("passkey_disabled")) {
    return new Error("Passkeys are not enabled in this Suru Collection Supabase project yet. Enable Passkey authentication in Authentication → Passkeys.");
  }
  if (lower.includes("notsupported") || lower.includes("not supported") ||
      lower.includes("notconfigured") || lower.includes("badconfiguration")) {
    if (Platform.OS === "ios") {
      return new Error("Native passkeys are not configured for this iPhone app yet. Suru Collection needs an Apple App Site Association file matching the app's Apple signing Team ID and the signed webcredentials entitlement. Email and Google sign-in remain available.");
    }
    return new Error("This Android device or its credential provider is not ready for passkeys. Check that the device has a secure screen lock and an up-to-date Google Password Manager / Credential Manager, then try again.");
  }
  return new Error(raw);
}

export async function registerNativePasskey() {
  try {
    if (!NativePasskeys.isSupported()) {
      throw new Error("This device or operating-system version does not support native passkeys.");
    }
    const { data: start, error: startError } = await supabase.auth.passkey.startRegistration();
    if (startError) throw startError;
    const nativeCredential = await NativePasskeys.create(start.options);
    if (!nativeCredential) throw new Error("Passkey setup was cancelled.");
    const publicKey = nativeCredential.response?.getPublicKey?.();
    const credential = {
      ...nativeCredential,
      response: {
        ...nativeCredential.response,
        ...(publicKey ? { publicKey } : {})
      }
    };
    const { data, error } = await supabase.auth.passkey.verifyRegistration({
      challengeId: start.challenge_id,
      credential
    });
    if (error) throw error;
    return data;
  } catch (error) {
    throw friendlyPasskeyError(error);
  }
}

export async function signInWithNativePasskey() {
  try {
    if (!NativePasskeys.isSupported()) {
      throw new Error("This device or operating-system version does not support native passkeys.");
    }
    const { data: start, error: startError } = await supabase.auth.passkey.startAuthentication();
    if (startError) throw startError;
    const credential = await NativePasskeys.get(start.options);
    if (!credential) throw new Error("Passkey sign-in was cancelled.");
    const { data, error } = await supabase.auth.passkey.verifyAuthentication({
      challengeId: start.challenge_id,
      credential
    });
    if (error) throw error;
    return data;
  } catch (error) {
    throw friendlyPasskeyError(error);
  }
}
