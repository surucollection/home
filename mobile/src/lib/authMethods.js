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

export async function continueWithGoogle({ link = false } = {}) {
  // This derives the redirect from the scheme registered in mobile/app.json.
  // Keep this exact URI allowlisted in Supabase Auth → URL Configuration.
  const redirectTo = Linking.createURL("auth/callback", { scheme: "suru" });
  const options = { redirectTo, skipBrowserRedirect: true };

  const { data, error } = link
    ? await supabase.auth.linkIdentity({ provider: "google", options })
    : await supabase.auth.signInWithOAuth({ provider: "google", options });

  if (error) throw error;
  if (!data?.url) {
    throw new Error("Google sign-in did not return an authorization URL. Check that Google is enabled in Supabase Auth.");
  }

  // On iOS this is handled by ASWebAuthenticationSession. Do not add a
  // Linking URL listener here: the native auth session owns its callback.
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result?.type !== "success" || !result?.url) {
    // A callback may have been delivered just as iOS closed the auth sheet.
    // Read the persisted Supabase session once before reporting a redirect error.
    const existingSession = await currentSessionOrNull();
    if (existingSession) return existingSession;

    if (result?.type === "cancel" || result?.type === "dismiss") {
      throw new Error(
        "iOS closed Google sign-in without delivering the Suru callback. Confirm that " +
        redirectTo +
        " (or suru://**) is allowed in Supabase Authentication → URL Configuration → Redirect URLs, then try again."
      );
    }
    throw new Error("Google sign-in did not return a callback to the Suru app. Please try again.");
  }

  const { parsed, query, hash } = getRedirectParts(result.url);
  if (parsed.protocol !== "suru:") {
    throw new Error("Google returned to an unexpected app link. Expected the Suru app callback scheme.");
  }

  const callbackError =
    query.get("error_description") || query.get("error") || query.get("error_code") ||
    hash.get("error_description") || hash.get("error") || hash.get("error_code");
  if (callbackError) throw new Error(callbackError);

  // PKCE returns a one-time authorization code. Exchange it on this same
  // device so Supabase can use the verifier stored in AsyncStorage.
  const code = query.get("code");
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      throw new Error("Google returned to Suru, but the authorization code could not be exchanged: " + exchangeError.message);
    }
  } else {
    // Backward compatibility for an implicit-flow callback from an older
    // Supabase configuration. New app builds use PKCE in supabase.js.
    const access_token = hash.get("access_token") || query.get("access_token");
    const refresh_token = hash.get("refresh_token") || query.get("refresh_token");
    if (!access_token || !refresh_token) {
      throw new Error("Google returned to Suru without an authorization code or session tokens. Check the Supabase redirect URL configuration.");
    }
    const { error: setError } = await supabase.auth.setSession({ access_token, refresh_token });
    if (setError) throw setError;
  }

  const activeSession = await currentSessionOrNull();
  if (!activeSession) {
    throw new Error("Google completed, but the Suru app did not store the signed-in session. Please try again.");
  }
  return activeSession;
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
