import React, { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { supabase } from "../lib/supabase";
import { money } from "../lib/format";
import { Button, Notice, Page, SectionHeading } from "../components/UI";
import { colors, radius } from "../theme";

const orderFields = "id,order_number,total,payment_method,payment_status,order_status,created_at,ncm_status,ncm_tracking_id,ncm_order_id,ncm_destination_branch,cancellation_status,invoice_number,order_items(quantity)";

export default function OrdersScreen({ goBack, navigate }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth?.session) {
        setOrders([]);
        setMessage("Sign in to see your orders.");
        return;
      }
      const { data: profile, error: profileError } = await supabase.rpc("my_customer_profile");
      if (profileError) throw profileError;
      if (!profile?.id) {
        setOrders([]);
        setMessage("Your customer profile is not available yet.");
        return;
      }
      const { data, error } = await supabase
        .from("orders")
        .select(orderFields)
        .eq("customer_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      setMessage(error?.message || "Unable to load your orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("suru-mobile-customer-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load().catch(() => {}))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  async function track(order) {
    try {
      const { data } = await supabase.from("invoice_settings").select("ncm_tracking_url").eq("id", true).maybeSingle();
      const base = data?.ncm_tracking_url || "https://portal.nepalcanmove.com/track/";
      const url = order.ncm_tracking_id ? base + encodeURIComponent(String(order.ncm_tracking_id)) : "https://portal.nepalcanmove.com/track/";
      await Linking.openURL(url);
    } catch {
      try { await Linking.openURL("https://portal.nepalcanmove.com/track/"); } catch {}
    }
  }

  return (
    <Page>
      <Text onPress={goBack} style={styles.back}>‹  Back</Text>
      <Text style={styles.eyebrow}>YOUR SURU ACCOUNT</Text>
      <Text style={styles.title}>My orders</Text>
      <Text style={styles.subtitle}>Order status and delivery tracking from the same store account.</Text>
      {loading && <Notice>Loading your orders…</Notice>}
      {!!message && <Notice tone={/sign in|profile/i.test(message) ? "info" : "error"}>{message}</Notice>}
      {!loading && !orders.length && !message && <Notice>You have not placed an order yet.</Notice>}
      {orders.map((order) => (
        <View key={order.id} style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderNumber}>#{order.order_number}</Text>
              <Text style={styles.date}>{new Date(order.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.price}>{money(order.total)}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.status}>{String(order.order_status || "pending").replace(/_/g, " ").toUpperCase()}</Text>
            <Text style={styles.payment}>{String(order.payment_status || "pending").toUpperCase()}</Text>
          </View>
          {!!order.ncm_status && <Text style={styles.detail}>Delivery: {order.ncm_status}</Text>}
          {!!order.ncm_destination_branch && <Text style={styles.detail}>Destination: {order.ncm_destination_branch}</Text>}
          {!!order.ncm_tracking_id && <Text style={styles.detail}>Tracking ID: {order.ncm_tracking_id}</Text>}
          {!!order.invoice_number && <Text style={styles.detail}>Invoice: {order.invoice_number}</Text>}
          {!!order.cancellation_status && order.cancellation_status !== "none" && <Text style={styles.detail}>Cancellation: {order.cancellation_status}</Text>}
          {!!order.ncm_tracking_id && <Pressable onPress={() => track(order)} style={styles.track}><Text style={styles.trackText}>Track delivery  →</Text></Pressable>}
        </View>
      ))}
      <Button title="Refresh orders" secondary onPress={load} loading={loading} />
      <Button title="Continue shopping" onPress={() => navigate("shop")} />
    </Page>
  );
}

const styles = {
  back: { color: colors.primary, fontWeight: "700", marginBottom: 18 },
  eyebrow: { color: colors.accent, fontSize: 9, letterSpacing: 1.8, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 28, fontWeight: "800", marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 15 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 15, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center" },
  orderNumber: { color: colors.primary, fontWeight: "900", fontSize: 15 },
  date: { color: colors.muted, fontSize: 10, marginTop: 4 },
  price: { color: colors.ink, fontWeight: "900", fontSize: 16 },
  statusRow: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 8 },
  status: { color: colors.success, backgroundColor: "#eaf5ef", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, fontSize: 9, fontWeight: "900" },
  payment: { color: colors.primary, backgroundColor: colors.surfaceSoft, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, fontSize: 9, fontWeight: "900" },
  detail: { color: colors.muted, fontSize: 11, marginTop: 4 },
  track: { alignSelf: "flex-start", marginTop: 12, borderBottomWidth: 1, borderBottomColor: colors.accent, paddingBottom: 3 },
  trackText: { color: colors.accent, fontWeight: "800", fontSize: 12 }
};