import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as NativePasskeys from "react-native-passkeys";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

function getRedirectParts(url) {
  const parsed = new URL(url);
  const query = parsed.searchParams;
  const hash = new URLSearchParams(String(parsed.hash || "").replace(/^#/, ""));
  return { query, hash };
}

export async function continueWithGoogle({ link = false } = {}) {
  const redirectTo = Linking.createURL("auth/callback");
  const options = { redirectTo, skipBrowserRedirect: true };
  const { data, error } = link
    ? await supabase.auth.linkIdentity({ provider: "google", options })
    : await supabase.auth.signInWithOAuth({ provider: "google", options });
  if (error) throw error;
  if (!data?.url) throw new Error("Google sign-in did not return an authorization URL. Check that Google is enabled in Supabase Auth.");
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success" || !result.url) throw new Error("Google sign-in was cancelled or did not return to Suru Collection.");
  const { query, hash } = getRedirectParts(result.url);
  const callbackError = query.get("error_description") || query.get("error") || hash.get("error_description") || hash.get("error");
  if (callbackError) throw new Error(callbackError);
  const code = query.get("code");
  if (code) {
    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return sessionData;
  }
  const access_token = hash.get("access_token") || query.get("access_token");
  const refresh_token = hash.get("refresh_token") || query.get("refresh_token");
  if (access_token && refresh_token) {
    const { data: sessionData, error: setError } = await supabase.auth.setSession({ access_token, refresh_token });
    if (setError) throw setError;
    return sessionData;
  }
  throw new Error("Google returned without an authentication code. Add " + redirectTo + " to Supabase Auth's allowed redirect URLs.");
}

export function isNativePasskeysSupported() {
  try { return NativePasskeys.isSupported(); } catch { return false; }
}

export async function registerNativePasskey() {
  if (!NativePasskeys.isSupported()) throw new Error("This device or app build does not support native passkeys.");
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
}

export async function signInWithNativePasskey() {
  if (!NativePasskeys.isSupported()) throw new Error("This device or app build does not support native passkeys.");
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
}
