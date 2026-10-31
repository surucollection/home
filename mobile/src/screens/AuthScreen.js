import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "../lib/supabase";
import { normalizeNepalPhone, isNepalMobile, provinces } from "../lib/format";
import { Button, Field, Notice, Page } from "../components/UI";
import { colors } from "../theme";

const empty = {
  first_name: "", last_name: "", email: "", password: "", confirm: "",
  phone: "", address: "", city: "", district: "", province: "", postal_code: ""
};

export default function AuthScreen({ onDone, goBack }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(empty);
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function login() {
    if (!form.email.trim() || !form.password) return setMessage("Enter your email address and password.");
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password
      });
      if (error) throw error;
      const { data: customer, error: profileError } = await supabase.rpc("my_customer_profile");
      if (profileError) throw profileError;
      if (!customer && data?.user) {
        const metadata = data.user.user_metadata || {};
        const { error: upsertError } = await supabase.from("customers").upsert({
          auth_user_id: data.user.id,
          name: metadata.name || "",
          first_name: metadata.first_name || "",
          last_name: metadata.last_name || "",
          email: data.user.email || "",
          phone: metadata.phone || "",
          address: metadata.address || null,
          city: metadata.city || null,
          district: metadata.district || null,
          province: metadata.province || null,
          postal_code: metadata.postal_code || null,
          is_active: true
        }, { onConflict: "auth_user_id" });
        if (upsertError) throw upsertError;
      }
      onDone?.();
    } catch (error) {
      setMessage(error?.message || "Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function register() {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.address.trim() ||
        !form.city.trim() || !form.district.trim() || !form.province.trim()) {
      return setMessage("Complete your name and delivery address.");
    }
    if (!form.email.trim()) return setMessage("Enter an email address for verification.");
    if (form.password.length < 6) return setMessage("Password must contain at least 6 characters.");
    if (form.password !== form.confirm) return setMessage("Passwords do not match.");
    const phone = normalizeNepalPhone(form.phone);
    if (!isNepalMobile(phone)) return setMessage("Enter a valid Nepal mobile number.");
    setBusy(true);
    setMessage("");
    try {
      const name = (form.first_name.trim() + " " + form.last_name.trim()).trim();
      const metadata = {
        name, first_name: form.first_name.trim(), last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(), phone, address: form.address.trim(),
        city: form.city.trim(), district: form.district.trim(), province: form.province,
        postal_code: form.postal_code.trim() || null
      };
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: { data: metadata }
      });
      if (error) throw error;
      if (!data?.user) throw new Error("Unable to start registration. Please try again.");
      setOtp("");
      setOtpStep(true);
      setMessage("A 6-digit verification code has been sent to " + form.email.trim() + ".");
    } catch (error) {
      setMessage(error?.message || "Registration could not be started.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyRegistration() {
    if (!/^\d{6}$/.test(otp.trim())) return setMessage("Enter the 6-digit OTP.");
    setBusy(true);
    setMessage("");
    try {
      const email = form.email.trim().toLowerCase();
      const { data, error } = await supabase.auth.verifyOtp({ email, token: otp.trim(), type: "signup" });
      if (error) throw error;
      if (!data?.user) throw new Error("Email verified, but no account session was returned. Please sign in.");
      const fullName = (form.first_name.trim() + " " + form.last_name.trim()).trim();
      const phone = normalizeNepalPhone(form.phone);
      const { data: customerId, error: profileError } = await supabase.rpc("link_verified_customer", {
        p_name: fullName,
        p_first_name: form.first_name.trim(),
        p_last_name: form.last_name.trim(),
        p_email: email,
        p_phone: phone,
        p_address: form.address.trim(),
        p_city: form.city.trim(),
        p_district: form.district.trim(),
        p_province: form.province,
        p_postal_code: form.postal_code.trim() || null
      });
      if (profileError) throw profileError;
      if (customerId) {
        const { error: addressError } = await supabase.rpc("save_customer_address", {
          p_address_id: null,
          p_label: "Home",
          p_full_name: fullName,
          p_phone: phone,
          p_address: form.address.trim(),
          p_city: form.city.trim(),
          p_district: form.district.trim(),
          p_province: form.province,
          p_postal_code: form.postal_code.trim() || null,
          p_is_default: true
        });
        if (addressError) console.warn("Default address could not be saved:", addressError.message);
      }
      onDone?.();
    } catch (error) {
      setMessage(error?.message || "Email verification failed.");
    } finally {
      setBusy(false);
    }
  }

  async function resendOtp() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: form.email.trim().toLowerCase() });
      if (error) throw error;
      setMessage("A new verification code has been sent.");
    } catch (error) {
      setMessage(error?.message || "Unable to resend OTP.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Page>
        <Text onPress={goBack} style={styles.back}>‹  Back</Text>
        <Text style={styles.eyebrow}>SURU COLLECTION</Text>
        <Text style={styles.title}>{otpStep ? "Verify your email" : mode === "login" ? "Welcome back" : "Create your account"}</Text>
        <Text style={styles.subtitle}>{otpStep ? "Enter the code sent to " + form.email : "Your website account works here too. Use the same email and password."}</Text>
        {!otpStep && <View style={styles.tabs}>
          <Text onPress={() => { setMode("login"); setMessage(""); }} style={[styles.tab, mode === "login" && styles.activeTab]}>Sign in</Text>
          <Text onPress={() => { setMode("register"); setMessage(""); }} style={[styles.tab, mode === "register" && styles.activeTab]}>Create account</Text>
        </View>}
        {otpStep ? <>
          <Field label="6-digit email OTP" value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" keyboardType="number-pad" />
          <Button title="Verify email and finish registration" onPress={verifyRegistration} loading={busy} />
          <Button title="Resend verification code" secondary onPress={resendOtp} disabled={busy} />
        </> : mode === "login" ? <>
          <Field label="Email address" value={form.email} onChangeText={(value) => update("email", value)} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Password" value={form.password} onChangeText={(value) => update("password", value)} secureTextEntry placeholder="Your password" autoCapitalize="none" />
          <Button title="Sign in" onPress={login} loading={busy} />
        </> : <>
          <View style={styles.twoCols}>
            <View style={{ flex: 1 }}><Field label="First name" value={form.first_name} onChangeText={(v) => update("first_name", v)} /></View>
            <View style={{ flex: 1 }}><Field label="Last name" value={form.last_name} onChangeText={(v) => update("last_name", v)} /></View>
          </View>
          <Field label="Email address" value={form.email} onChangeText={(v) => update("email", v)} keyboardType="email-address" autoCapitalize="none" />
          <Field label="Nepal mobile number" value={form.phone} onChangeText={(v) => update("phone", v.replace(/[^0-9+]/g, "").slice(0, 14))} keyboardType="phone-pad" />
          <Field label="Delivery address" value={form.address} onChangeText={(v) => update("address", v)} multiline />
          <Field label="City / Municipality" value={form.city} onChangeText={(v) => update("city", v)} />
          <Field label="District" value={form.district} onChangeText={(v) => update("district", v)} />
          <Text style={styles.pickerLabel}>Province</Text>
          <View style={styles.pickerBox}><Picker selectedValue={form.province} onValueChange={(v) => update("province", v)}><Picker.Item label="Select province" value="" />{provinces.map((item) => <Picker.Item key={item} label={item} value={item} />)}</Picker></View>
          <Field label="Postal code (optional)" value={form.postal_code} onChangeText={(v) => update("postal_code", v)} keyboardType="number-pad" />
          <Field label="Password" value={form.password} onChangeText={(v) => update("password", v)} secureTextEntry autoCapitalize="none" />
          <Field label="Confirm password" value={form.confirm} onChangeText={(v) => update("confirm", v)} secureTextEntry autoCapitalize="none" />
          <Button title="Create account and send OTP" onPress={register} loading={busy} />
        </>}
        {!!message && <Notice tone={/unable|failed|error|must|enter|complete|match|not /i.test(message) ? "error" : "info"}>{message}</Notice>}
        <Text style={styles.footnote}>Google sign-in and passkeys can be added after native deep-link settings are configured for both app stores.</Text>
      </Page>
    </KeyboardAvoidingView>
  );
}

const styles = {
  back: { color: colors.primary, fontWeight: "700", marginBottom: 18 },
  eyebrow: { color: colors.accent, fontSize: 9, letterSpacing: 1.8, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 28, fontWeight: "800", marginTop: 6 },
  subtitle: { color: colors.muted, lineHeight: 20, fontSize: 13, marginTop: 7, marginBottom: 14 },
  tabs: { flexDirection: "row", backgroundColor: colors.surfaceSoft, borderRadius: 14, padding: 4, marginBottom: 18 },
  tab: { flex: 1, textAlign: "center", paddingVertical: 11, color: colors.muted, fontWeight: "700", overflow: "hidden", borderRadius: 11 },
  activeTab: { color: colors.primary, backgroundColor: colors.white },
  twoCols: { flexDirection: "row", gap: 10 },
  pickerLabel: { color: colors.ink, fontSize: 12, fontWeight: "700", marginBottom: 5 },
  pickerBox: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: 12, overflow: "hidden" },
  footnote: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 16 }
};