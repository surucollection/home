import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { supabase } from "../lib/supabase";
import { Button, Field, Notice, Page } from "../components/UI";
import NepalLocationFields, { canonicalLocationProvince } from "../components/NepalLocationFields";
import { colors, radius } from "../theme";

const blankAddress = () => ({
  label: "Home", full_name: "", phone: "", address: "", city: "",
  district: "", province: "", postal_code: "", is_default: false
});

export default function AddressesScreen({ goBack }) {
  const [customer, setCustomer] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [draft, setDraft] = useState(blankAddress);
  const [editingId, setEditingId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const { data: profile, error: profileError } = await supabase.rpc("my_customer_profile");
      if (profileError) throw profileError;
      if (!profile?.id) throw new Error("Your customer profile is not available. Please sign in again.");
      setCustomer(profile);
      const { data, error } = await supabase.from("customer_addresses")
        .select("id,customer_id,label,full_name,phone,address,city,district,province,postal_code,is_default,created_at,updated_at")
        .eq("customer_id", profile.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      setAddresses(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(error?.message || "Unable to load saved addresses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditingId("");
    setDraft({
      ...blankAddress(),
      full_name: customer?.name || "",
      phone: customer?.phone || "",
      address: customer?.address || "",
      city: customer?.city || "",
      district: customer?.district || "",
      province: canonicalLocationProvince(customer?.province || ""),
      postal_code: customer?.postal_code || "",
      is_default: addresses.length === 0
    });
    setFormOpen(true);
    setMessage("");
  }

  function openEdit(item) {
    setEditingId(item.id);
    setDraft({
      label: item.label || "Home",
      full_name: item.full_name || "",
      phone: item.phone || "",
      address: item.address || "",
      city: item.city || "",
      district: item.district || "",
      province: canonicalLocationProvince(item.province || ""),
      postal_code: item.postal_code || "",
      is_default: !!item.is_default
    });
    setFormOpen(true);
    setMessage("");
  }

  const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  async function save() {
    const required = ["label", "full_name", "phone", "address", "city", "district", "province"];
    if (required.some((key) => !String(draft[key] || "").trim())) return setMessage("Complete all required address fields.");
    if (!customer?.id) return setMessage("Your customer profile is not available.");
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.rpc("save_customer_address", {
        p_address_id: editingId || null,
        p_label: draft.label.trim(),
        p_full_name: draft.full_name.trim(),
        p_phone: draft.phone.trim(),
        p_address: draft.address.trim(),
        p_city: draft.city.trim(),
        p_district: draft.district.trim(),
        p_province: canonicalLocationProvince(draft.province),
        p_postal_code: draft.postal_code.trim() || null,
        p_is_default: !!draft.is_default
      });
      if (error) throw error;
      const savedMessage = editingId ? "Address updated successfully." : "Address added successfully.";
      setFormOpen(false);
      setEditingId("");
      await load();
      setMessage(savedMessage);
    } catch (error) {
      setMessage(error?.message || "Unable to save this address.");
    } finally {
      setBusy(false);
    }
  }

  async function setDefault(item) {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.rpc("save_customer_address", {
        p_address_id: item.id,
        p_label: item.label || "Home",
        p_full_name: item.full_name || "",
        p_phone: item.phone || "",
        p_address: item.address || "",
        p_city: item.city || "",
        p_district: item.district || "",
        p_province: canonicalLocationProvince(item.province || ""),
        p_postal_code: item.postal_code || null,
        p_is_default: true
      });
      if (error) throw error;
      await load();
      setMessage("Default address updated.");
    } catch (error) {
      setMessage(error?.message || "Unable to set the default address.");
    } finally {
      setBusy(false);
    }
  }

  function remove(item) {
    Alert.alert("Delete address", "Remove this saved delivery address?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        setBusy(true);
        setMessage("");
        try {
          const { error } = await supabase.rpc("delete_customer_address", { p_address_id: item.id });
          if (error) throw error;
          await load();
          setMessage("Address deleted.");
        } catch (error) {
          setMessage(error?.message || "Unable to delete this address.");
        } finally {
          setBusy(false);
        }
      } }
    ]);
  }

  return <Page>
    <Text style={styles.eyebrow}>DELIVERY DETAILS</Text>
    <Text style={styles.title}>Saved addresses</Text>
    <Text style={styles.subtitle}>Manage Home, Office or other delivery addresses. Your default address can be used to speed up checkout.</Text>
    {!!message && <Notice tone={/success|deleted|updated|added/i.test(message) ? "success" : "error"}>{message}</Notice>}
    {loading && <Notice>Loading your saved addresses…</Notice>}
    {!loading && !formOpen && <>
      {!addresses.length && <Notice>You have no saved addresses yet. Add one for faster checkout.</Notice>}
      {addresses.map((item) => <View key={item.id} style={styles.card}>
        <View style={styles.cardHeading}>
          <Text style={styles.addressLabel}>{item.label || "Address"}</Text>
          {item.is_default && <Text style={styles.defaultTag}>DEFAULT</Text>}
        </View>
        <Text style={styles.name}>{item.full_name}</Text>
        <Text style={styles.detail}>{item.phone}</Text>
        <Text style={styles.detail}>{[item.address, item.city, item.district, item.province, item.postal_code].filter(Boolean).join(", ")}</Text>
        <View style={styles.actions}>
          {!item.is_default && <Pressable onPress={() => setDefault(item)} disabled={busy}><Text style={styles.actionText}>Set default</Text></Pressable>}
          <Pressable onPress={() => openEdit(item)} disabled={busy}><Text style={styles.actionText}>Edit</Text></Pressable>
          <Pressable onPress={() => remove(item)} disabled={busy}><Text style={styles.deleteText}>Delete</Text></Pressable>
        </View>
      </View>)}
      <Button title="Add new address" onPress={openNew} />
    </>}
    {formOpen && <>
      <Text style={styles.formTitle}>{editingId ? "Edit address" : "Add new address"}</Text>
      <Field label="Address label" value={draft.label} onChangeText={(v) => updateDraft("label", v)} placeholder="Home, Office" />
      <Field label="Full name" value={draft.full_name} onChangeText={(v) => updateDraft("full_name", v)} />
      <Field label="Phone number" value={draft.phone} onChangeText={(v) => updateDraft("phone", v)} keyboardType="phone-pad" />
      <Field label="Delivery address" value={draft.address} onChangeText={(v) => updateDraft("address", v)} multiline />
      <NepalLocationFields
        province={draft.province}
        district={draft.district}
        city={draft.city}
        onProvinceChange={(v) => setDraft((current) => ({ ...current, province: v, district: "", city: "" }))}
        onDistrictChange={(v) => setDraft((current) => ({ ...current, district: v, city: "" }))}
        onCityChange={(v) => updateDraft("city", v)}
      />
      <Field label="Postal code (optional)" value={draft.postal_code} onChangeText={(v) => updateDraft("postal_code", v)} keyboardType="number-pad" />
      <Pressable onPress={() => updateDraft("is_default", !draft.is_default)} style={styles.defaultRow}>
        <View style={[styles.checkbox, draft.is_default && styles.checkboxChecked]} />
        <Text style={styles.detail}>Set as default delivery address</Text>
      </Pressable>
      <Button title={busy ? "Saving…" : editingId ? "Save address" : "Add address"} onPress={save} loading={busy} />
      <Button title="Cancel" secondary disabled={busy} onPress={() => { setFormOpen(false); setEditingId(""); }} />
    </>}
    <Button title="Back to account" secondary onPress={goBack} />
  </Page>;
}

const styles = {
  eyebrow: { color: colors.accent, fontSize: 9, letterSpacing: 1.8, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 27, fontWeight: "800", marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 15 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: 14, marginBottom: 10 },
  cardHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addressLabel: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  defaultTag: { color: colors.success, fontSize: 9, fontWeight: "900" },
  name: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: 10 },
  detail: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  actions: { flexDirection: "row", gap: 18, marginTop: 12 },
  actionText: { color: colors.accent, fontSize: 12, fontWeight: "800" },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  formTitle: { color: colors.ink, fontSize: 16, fontWeight: "800", marginVertical: 12 },
  defaultRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: colors.primary, borderRadius: 4 },
  checkboxChecked: { backgroundColor: colors.primary }
};
