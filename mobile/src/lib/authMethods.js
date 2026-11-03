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

  // This API uses ASWebAuthenticationSession on iOS and a Custom Tab plus
  // AppState/Linking on Android. It closes the browser and resolves only when
  // the configured custom-scheme callback is delivered to the app.
  const authResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (authResult?.type !== "success" || !authResult?.url) {
    if (authResult?.type === "cancel" || authResult?.type === "dismiss") {
      throw new Error("Google sign-in was closed before Suru received the sign-in callback. No login was completed.");
    }
    throw new Error("Google sign-in did not return to the Suru app. Confirm suru://auth/callback is allowlisted in Supabase Auth → URL Configuration and rebuild the app if its URL scheme changed.");
  }

  const { parsed, query, hash } = getRedirectParts(authResult.url);
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
}

export function isNativePasskeysSupported() {
  try { return NativePasskeys.isSupported(); } catch { return false; }
}

function friendlyPasskeyError(error) {
  const raw = String(error?.message || error || "Passkey operation could not be completed.");
  const details = [error?.code, error?.error, error?.name, raw].filter(Boolean).join(" ");
  const lower = details.toLowerCase();

  if (lower.includes("passkey_disabled")) {
    return new Error("Passkeys are not enabled in this Suru Collection Supabase project yet. Enable Passkey authentication in Authentication → Passkeys.");
  }

  // Domain-link and certificate errors are configuration failures, not a
  // missing Google account or an unsupported phone.
  if (lower.includes("badconfiguration") || lower.includes("assetlinks") ||
      lower.includes("associated domain") || lower.includes("domain association") ||
      lower.includes("could not verify calling app")) {
    if (Platform.OS === "ios") {
      return new Error("Suru passkeys are not associated with this iPhone build yet. The site needs an Apple App Site Association file matching the signed app's Apple Team ID and webcredentials entitlement.");
    }
    return new Error("Suru passkey domain verification failed. Check https://suru.com.np/.well-known/assetlinks.json for package np.com.suru.collection and the exact APK SHA-256 signing fingerprint, including the common.get_login_creds relation. Supabase Authentication → Passkeys must also allow the Android origin android:apk-key-hash:-sYXRdwJA3hvue3mKpYrOZ9zSPC7b4mbgzJmdZEDO5w.");
  }

  if (lower.includes("no credentials") || lower.includes("nocredentials") ||
      lower.includes("no credential")) {
    return new Error("No Suru passkey is saved in this device's credential manager yet. Sign in with Google or email first, then register a passkey from Account → Security.");
  }

  if (lower.includes("notsupported") || lower.includes("not supported") ||
      lower.includes("notconfigured") || lower.includes("no create option")) {
    if (Platform.OS === "ios") {
      return new Error("This iPhone or its credential provider does not support native passkeys. Update iOS and enable iCloud Keychain or another supported passkey provider. Google and email sign-in remain available.");
    }
    return new Error("This Android device or its credential provider does not support passkeys. Enable a secure screen lock, sign in to a Google account, and update Google Play Services and Google Password Manager / Credential Manager.");
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
