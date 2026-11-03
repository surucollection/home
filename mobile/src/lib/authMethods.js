import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import * as NativePasskeys from "react-native-passkeys";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

const APP_AUTH_REDIRECT = "suru://auth/callback";

function getRedirectParts(url) {
  const parsed = new URL(url);
  const query = parsed.searchParams;
  const hash = new URLSearchParams(String(parsed.hash || "").replace(/^#/, ""));
  return { query, hash };
}

function isAppAuthCallback(url) {
  if (!url) return false;
  try {
    const candidate = new URL(url);
    const expected = new URL(APP_AUTH_REDIRECT);
    return candidate.protocol === expected.protocol &&
      candidate.hostname === expected.hostname &&
      candidate.pathname.replace(/\/$/, "") === expected.pathname.replace(/\/$/, "");
  } catch {
    return false;
  }
}

async function readCallbackUrl(result, callbackPromise) {
  if (result?.type === "success" && isAppAuthCallback(result.url)) return result.url;

  // Some iOS/Android browser hand-offs activate the app through the URL
  // listener but resolve the browser sheet as dismissed. Accept the matching
  // app callback rather than treating a successful OAuth hand-off as a cancel.
  try {
    const initialUrl = await Linking.getInitialURL();
    if (isAppAuthCallback(initialUrl)) return initialUrl;
  } catch {}

  return await Promise.race([
    callbackPromise,
    new Promise((resolve) => setTimeout(() => resolve(""), 4000))
  ]);
}

export async function continueWithGoogle({ link = false } = {}) {
  const redirectTo = APP_AUTH_REDIRECT;
  const options = { redirectTo, skipBrowserRedirect: true };
  const { data, error } = link
    ? await supabase.auth.linkIdentity({ provider: "google", options })
    : await supabase.auth.signInWithOAuth({ provider: "google", options });
  if (error) throw error;
  if (!data?.url) {
    throw new Error("Google sign-in did not return an authorization URL. Check that Google is enabled in Supabase Auth.");
  }

  let resolveCallback;
  const callbackPromise = new Promise((resolve) => { resolveCallback = resolve; });
  const subscription = Linking.addEventListener("url", ({ url }) => {
    if (isAppAuthCallback(url)) resolveCallback(url);
  });

  let callbackUrl = "";
  try {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    callbackUrl = await readCallbackUrl(result, callbackPromise);

    if (!callbackUrl) {
      const { data: existingSession, error: existingSessionError } = await supabase.auth.getSession();
      if (existingSessionError) throw existingSessionError;
      if (existingSession?.session?.user) return existingSession;
      if (result?.type === "cancel" || result?.type === "dismiss") {
        throw new Error("Google sign-in was cancelled before Google returned to the Suru app.");
      }
      throw new Error("Google returned without opening the Suru app. Add suru://auth/callback to Supabase Authentication → URL Configuration → Redirect URLs.");
    }

    const { query, hash } = getRedirectParts(callbackUrl);
    const callbackError =
      query.get("error_description") || query.get("error") || query.get("error_code") ||
      hash.get("error_description") || hash.get("error") || hash.get("error_code");
    if (callbackError) throw new Error(callbackError);

    const code = query.get("code");
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        throw new Error("Google returned to Suru, but the sign-in code could not be exchanged: " + exchangeError.message);
      }
    } else {
      const access_token = hash.get("access_token") || query.get("access_token");
      const refresh_token = hash.get("refresh_token") || query.get("refresh_token");
      if (!access_token || !refresh_token) {
        throw new Error("Google returned to Suru without an authentication code or session tokens. Check the Supabase redirect URL configuration.");
      }
      const { error: setError } = await supabase.auth.setSession({ access_token, refresh_token });
      if (setError) throw setError;
    }

    const { data: activeSession, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!activeSession?.session?.user) {
      throw new Error("Google returned to Suru, but the app did not save the signed-in session. Please try again.");
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
