import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useStore } from "../StoreContext";
import { supabase } from "../lib/supabase";
import { registerNativePasskey, continueWithGoogle } from "../lib/authMethods";
import { Button, Field, Notice, Page } from "../components/UI";
import { colors, radius } from "../theme";

export default function SecurityScreen({ goBack }) {
  const { session } = useStore();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [passkeys, setPasskeys] = useState([]);
  const [googleLinked, setGoogleLinked] = useState(
    Boolean(session?.user?.identities?.some((identity) => identity.provider === "google"))
  );
  const [message, setMessage] = useState("");
  const [passkeyMessage, setPasskeyMessage] = useState("");

  useEffect(() => {
    let active = true;
    supabase.auth.passkey.list().then(({ data, error }) => {
      if (error) throw error;
      if (active) setPasskeys(Array.isArray(data) ? data : []);
    }).catch((error) => {
      if (active) setPasskeyMessage(error?.message || "Passkey status could not be loaded.");
    });
    return () => { active = false; };
  }, []);

  async function changePassword() {
    if (password.length < 6) return setMessage("Password must contain at least 6 characters.");
    if (password !== confirm) return setMessage("Passwords do not match.");
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirm("");
      setMessage("Password updated successfully.");
    } catch (error) {
      setMessage(error?.message || "Unable to update your password.");
    } finally {
      setBusy(false);
    }
  }

  async function addPasskey() {
    setPasskeyBusy(true);
    setPasskeyMessage("");
    try {
      const result = await registerNativePasskey();
      const { data, error } = await supabase.auth.passkey.list();
      if (error) throw error;
      setPasskeys(Array.isArray(data) ? data : result ? [result] : []);
      setPasskeyMessage("Passkey added successfully.");
    } catch (error) {
      setPasskeyMessage(error?.message || "Passkey registration could not be completed.");
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function deletePasskey(passkey) {
    setPasskeyBusy(true);
    setPasskeyMessage("");
    try {
      const { error } = await supabase.auth.passkey.delete({ passkeyId: passkey.id });
      if (error) throw error;
      setPasskeys((current) => current.filter((item) => item.id !== passkey.id));
      setPasskeyMessage("Passkey deleted.");
    } catch (error) {
      setPasskeyMessage(error?.message || "Unable to delete this passkey.");
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function linkGoogle() {
    setGoogleBusy(true);
    setMessage("");
    try {
      await continueWithGoogle({ link: true });
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      setGoogleLinked(Boolean(data?.user?.identities?.some((identity) => identity.provider === "google")));
      setMessage("Google account linked successfully.");
    } catch (error) {
      setMessage(error?.message || "Google linking could not be completed.");
    } finally {
      setGoogleBusy(false);
    }
  }

  return <Page>
    <Text style={styles.eyebrow}>ACCOUNT SECURITY</Text>
    <Text style={styles.title}>Sign-in & security</Text>
    <Text style={styles.subtitle}>Protect your Suru Collection account and keep your sign-in details current.</Text>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Change password</Text>
      <Text style={styles.copy}>Choose a new password for your account. Use at least 6 characters.</Text>
      <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="Enter new password" />
      <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" placeholder="Re-enter new password" />
      {!!message && <Notice tone={message.includes("successfully") ? "success" : "error"}>{message}</Notice>}
      <Button title={busy ? "Updating…" : "Update password"} onPress={changePassword} loading={busy} />
    </View>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Google Sign-In</Text>
      <Text style={styles.copy}>{googleLinked ? "Google is linked to this Suru Collection account." : "Link Google to your existing account for another secure sign-in option."}</Text>
      {!googleLinked && <Button title={googleBusy ? "Connecting…" : "Link Google account"} secondary onPress={linkGoogle} loading={googleBusy} />}
    </View>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Passkeys</Text>
      <Text style={styles.copy}>Use Face ID, Touch ID or your device screen lock to sign in. Passkey setup requires the Suru Collection passkey settings and domain verification to be enabled.</Text>
      {!!passkeyMessage && <Notice tone={passkeyMessage.includes("success") || passkeyMessage.includes("deleted") ? "success" : "error"}>{passkeyMessage}</Notice>}
      {passkeys.map((passkey, index) => <View key={passkey.id} style={styles.passkeyRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.passkeyName}>{passkey.friendly_name || "Passkey " + (index + 1)}</Text>
          <Text style={styles.copySmall}>{passkey.created_at ? "Added " + new Date(passkey.created_at).toLocaleDateString() : "Registered passkey"}</Text>
        </View>
        <Text onPress={() => deletePasskey(passkey)} style={styles.deleteText}>Delete</Text>
      </View>)}
      <Button title={passkeyBusy ? "Working…" : "Add a passkey"} secondary onPress={addPasskey} loading={passkeyBusy} />
    </View>
    <Button title="Back to account" secondary onPress={goBack} />
  </Page>;
}

const styles = {
  eyebrow: { color: colors.accent, fontSize: 9, letterSpacing: 1.8, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 27, fontWeight: "800", marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 15 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: 15, marginBottom: 12 },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  copy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: 12 },
  copySmall: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  passkeyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  passkeyName: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  deleteText: { color: colors.danger, fontSize: 11, fontWeight: "800", padding: 6 }
};
