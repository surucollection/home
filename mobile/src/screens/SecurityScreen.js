import React, { useState } from "react";
import { Text, View } from "react-native";
import { supabase } from "../lib/supabase";
import { Button, Field, Notice, Page } from "../components/UI";
import { colors, radius } from "../theme";

export default function SecurityScreen({ goBack }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

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
      <Text style={styles.cardTitle}>Passkeys & Google Sign-In</Text>
      <Text style={styles.copy}>These sign-in methods are not enabled in the native app yet. They can still be managed from your Suru Collection account on the website.</Text>
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
  copy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: 12 }
};
