import React, { useEffect, useState } from "react";
import { Text } from "react-native";
import { useStore } from "../StoreContext";
import { supabase } from "../lib/supabase";
import { Button, Field, Notice, Page } from "../components/UI";
import { colors } from "../theme";

export default function ProfileScreen({ goBack }) {
  const { session, profile, refreshProfile } = useStore();
  const [name, setName] = useState(profile?.name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setName(profile?.name || "");
    setPhone(profile?.phone || "");
  }, [profile?.name, profile?.phone]);

  async function save() {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (!cleanName) return setMessage("Please enter your name.");
    if (!cleanPhone || cleanPhone.replace(/[^0-9]/g, "").length < 7) return setMessage("Please enter a valid phone number.");
    if (!session?.user?.id) return setMessage("Your session has expired. Please sign in again.");
    setBusy(true);
    setMessage("");
    try {
      const parts = cleanName.split(/\s+/);
      const { error } = await supabase.from("customers").update({
        name: cleanName,
        first_name: parts[0] || "",
        last_name: parts.slice(1).join(" "),
        phone: cleanPhone,
        updated_at: new Date().toISOString()
      }).eq("auth_user_id", session.user.id);
      if (error) throw error;
      await refreshProfile();
      setMessage("Your personal details were updated.");
    } catch (error) {
      setMessage(error?.message || "Unable to update your details.");
    } finally {
      setBusy(false);
    }
  }

  return <Page>
    <Text style={styles.eyebrow}>PROFILE</Text>
    <Text style={styles.title}>Personal details</Text>
    <Text style={styles.subtitle}>Keep the contact information for your Suru account up to date.</Text>
    <Field label="Full name" value={name} onChangeText={setName} placeholder="Your full name" />
    <Field label="Email address" value={session?.user?.email || ""} editable={false} />
    <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="98XXXXXXXX" />
    {!!message && <Notice tone={message.includes("updated") ? "success" : "error"}>{message}</Notice>}
    <Button title="Save details" onPress={save} loading={busy} />
    <Button title="Back to account" secondary onPress={goBack} />
  </Page>;
}

const styles = {
  eyebrow: { color: colors.accent, fontSize: 9, letterSpacing: 1.8, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 27, fontWeight: "800", marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 16 }
};
