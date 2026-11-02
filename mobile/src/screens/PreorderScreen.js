import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useStore } from "../StoreContext";
import { supabase } from "../lib/supabase";
import {
  money, normalizeNepalPhone, isNepalMobile, canonicalProvince, provinces
} from "../lib/format";
import { Button, Field, Notice, Page } from "../components/UI";
import NepalLocationFields from "../components/NepalLocationFields";
import FonepayPaymentPanel from "../components/FonepayPaymentPanel";
import { colors, radius } from "../theme";

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  district: "",
  province: "",
  postal_code: "",
  note: ""
};

export default function PreorderScreen({ productId, size = "", color = "", quantity = 1, navigate, goBack }) {
  const { products, session, profile, refreshProfile } = useStore();
  const product = products.find((item) => item.id === productId);
  const [form, setForm] = useState(emptyForm);
  const [branches, setBranches] = useState([]);
  const [branchBusy, setBranchBusy] = useState(true);
  const [branch, setBranch] = useState("");
  const [rate, setRate] = useState(null);
  const [rateBusy, setRateBusy] = useState(false);
  const [rateError, setRateError] = useState("");
  const [advancePercent, setAdvancePercent] = useState(30);
  const [paymentPurpose, setPaymentPurpose] = useState("cod_advance");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [payment, setPayment] = useState(null);
  const [confirmed, setConfirmed] = useState(null);

  const normalizeLocation = (value) => String(value || "").toLowerCase().replace(/\bprovince\b|\bdistrict\b|\bmetropolitan city\b|\bmunicipality\b|\bcity\b/g, "").replace(/[^a-z0-9]/g, "");
  const branchOptions = useMemo(() => {
    if (!form.district) return branches;
    const district = normalizeLocation(form.district);
    const province = normalizeLocation(form.province);
    const filtered = branches.filter((item) =>
      normalizeLocation(item.district_name || item.district) === district &&
      (!item.province_name && !item.province || !province || normalizeLocation(item.province_name || item.province) === province)
    );
    return filtered.length ? filtered : branches;
  }, [branches, form.district, form.province]);
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const productAmount = Math.round(Number(product?.price || 0) * qty * 0.95);
  const deliveryFee = Number(rate?.advanceDeliveryCharge || 0);
  const quoteMatchesBranch = !!(
    branch &&
    rate &&
    !rateBusy &&
    String(rate.destinationBranch || "").trim().toUpperCase() === String(branch).trim().toUpperCase() &&
    deliveryFee > 0
  );
  const estimatedTotal = productAmount + (quoteMatchesBranch ? Math.round(deliveryFee) : 0);
  const payNow = paymentPurpose === "full"
    ? estimatedTotal
    : Math.round(estimatedTotal * advancePercent / 100);
  const balanceOnDelivery = paymentPurpose === "cod_advance"
    ? Math.max(0, estimatedTotal - payNow)
    : 0;

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [{ data: profileData }, branchResult, advanceResult] = await Promise.all([
          supabase.rpc("my_customer_profile"),
          supabase.functions.invoke("ncm-branches"),
          supabase.rpc("get_preorder_advance_percent")
        ]);
        if (!active) return;

        const customer = profileData || profile;
        if (customer) {
          const savedCity = String(customer.city || "").trim();
          setForm((current) => ({
            ...current,
            name: current.name || customer.name || [customer.first_name, customer.last_name].filter(Boolean).join(" "),
            phone: current.phone || customer.phone || "",
            email: current.email || session?.user?.email || "",
            address: current.address || customer.address || "",
            city: current.city || savedCity.split(",")[0].trim(),
            district: current.district || customer.district || (savedCity.includes(",") ? savedCity.split(",").slice(1).join(",").trim() : ""),
            province: current.province || canonicalProvince(customer.province || ""),
            postal_code: current.postal_code || customer.postal_code || ""
          }));
        }

        if (branchResult.error) throw branchResult.error;
        const list = Array.isArray(branchResult.data)
          ? branchResult.data
          : branchResult.data?.branches || [];
        setBranches(list);

        const savedBranch = String(customer?.ncm_destination_branch || "").trim();
        const exactBranch = list.find((item) =>
          String(item.name || "").trim().toLowerCase() === savedBranch.toLowerCase()
        );
        if (exactBranch) {
          setBranch(exactBranch.name);
        } else if (customer) {
          const districtName = String(customer.district || "").trim().toLowerCase();
          const cityName = String(customer.city || "").split(",")[0].trim().toLowerCase();
          const match = list.find((item) => {
            const name = String(item.name || "").toLowerCase();
            const municipality = String(item.municipality || "").toLowerCase();
            const district = String(item.district_name || item.district || "").toLowerCase();
            return (cityName && (municipality === cityName || name.includes(cityName))) ||
              (districtName && (district === districtName || name.includes(districtName)));
          });
          if (match) setBranch(match.name);
        }

        const percentage = Number(advanceResult?.data);
        if (Number.isFinite(percentage) && percentage >= 1 && percentage <= 100) {
          setAdvancePercent(percentage);
        }
      } catch (error) {
        if (active) setMessage(error?.message || "Unable to load your pre-order details.");
      } finally {
        if (active) setBranchBusy(false);
      }
    })();
    return () => { active = false; };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!branch) {
      setRate(null);
      setRateError("");
      setRateBusy(false);
      return;
    }
    let active = true;
    setRateBusy(true);
    setRateError("");
    supabase.functions.invoke("ncm-rate", { body: { destinationBranch: branch } })
      .then(({ data, error }) => {
        if (error) throw error;
        if (data?.error || data?.ok === false) throw new Error(data.error || "NCM could not return a delivery rate.");
        if (active) setRate(data || null);
      })
      .catch((error) => {
        if (active) {
          setRate(null);
          setRateError(error?.message || "Unable to calculate NCM delivery charge.");
        }
      })
      .finally(() => { if (active) setRateBusy(false); });
    return () => { active = false; };
  }, [branch]);

  useEffect(() => {
    if (!payment?.intentId) return;
    let stopped = false;
    let timer;
    const check = async () => {
      if (stopped) return;
      try {
        const { data, error } = await supabase.functions.invoke("fonepay-payment", {
          body: { action: "preorder_status", intentId: payment.intentId }
        });
        if (stopped || error || !data) return;
        if (data.verified) {
          stopped = true;
          setConfirmed({
            orderNumber: data.order_number || data.orderNumber || "",
            purpose: data.payment_purpose || payment.purpose || paymentPurpose,
            advancePaid: Number(data.advance_paid || payment.amount || 0),
            balanceDue: Number(data.balance_due ?? payment.balanceDue ?? 0)
          });
          setPayment(null);
        } else if (String(data.paymentStatus || "").toLowerCase() === "failed") {
          setMessage("Fonepay reported that this payment attempt failed. Please contact Suru Collection before trying again.");
        }
      } catch (error) {
        console.warn("Pre-order payment status check failed:", error?.message || error);
      }
    };
    check();
    timer = setInterval(check, 5000);
    return () => { stopped = true; if (timer) clearInterval(timer); };
  }, [payment?.intentId]);

  async function submitPreorder() {
    if (submitting || payment) return;
    if (!session?.user) {
      setMessage("Please sign in before placing a pre-order.");
      navigate("auth", {
        returnRoute: {
          name: "preorder",
          params: { productId, size, color, quantity: qty }
        }
      });
      return;
    }
    if (!product?.preorder_enabled) {
      setMessage("Pre-orders are not enabled for this product.");
      return;
    }
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim() ||
        !form.city.trim() || !form.district.trim() || !form.province.trim()) {
      setMessage("Complete your name, phone, delivery address, province, district and city.");
      return;
    }
    if (!isNepalMobile(normalizeNepalPhone(form.phone))) {
      setMessage("Enter a valid Nepal mobile number.");
      return;
    }
    if (!branch) {
      setMessage("Select your NCM destination branch.");
      return;
    }
    if (!quoteMatchesBranch) {
      setMessage(rateError || "Wait for the selected NCM branch delivery charge to load.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const nameParts = form.name.trim().split(/\s+/);
      const normalizedPhone = normalizeNepalPhone(form.phone);
      const customer = {
        name: form.name.trim(),
        phone: normalizedPhone,
        address: form.address.trim(),
        city: form.city.trim(),
        district: form.district.trim(),
        province: canonicalProvince(form.province),
        postal_code: form.postal_code.trim() || null,
        ncm_destination_branch: branch,
        email: (session.user.email || form.email || "").trim().toLowerCase() || null
      };
      const { error: saveError } = await supabase.from("customers").update({
        name: customer.name,
        first_name: nameParts[0] || "",
        last_name: nameParts.slice(1).join(" "),
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        district: customer.district,
        province: customer.province,
        postal_code: customer.postal_code,
        ncm_destination_branch: branch,
        updated_at: new Date().toISOString()
      }).eq("auth_user_id", session.user.id);
      if (saveError) throw saveError;

      const { data, error } = await supabase.functions.invoke("fonepay-payment", {
        body: {
          action: "preorder_create",
          productCode: product.product_code,
          size: size || null,
          color: color || product.color || null,
          qty,
          balanceMethod: paymentPurpose === "cod_advance" ? "cod" : "paid",
          paymentPurpose,
          paymentMethod: "fonepay",
          customer,
          customerNote: form.note.trim() || null
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.alreadyPaid) {
        setConfirmed({
          orderNumber: data.order_number || data.orderNumber || "",
          purpose: data.purpose || paymentPurpose,
          advancePaid: Number(data.advance_paid ?? data.advance_amount ?? 0),
          balanceDue: Number(data.balance_due ?? data.balance_amount ?? 0)
        });
        await refreshProfile().catch(() => {});
        return;
      }

      const amount = Number(data?.amount);
      if (!data?.intentId || !data?.qrString || !Number.isFinite(amount) || amount <= 0) {
        throw new Error("Fonepay did not return a valid pre-order QR or amount. Please contact Suru Collection before creating another pre-order.");
      }
      setPayment({
        ...data,
        amount,
        purpose: data.purpose || paymentPurpose,
        balanceDue: Number(data.balanceDue || 0)
      });
    } catch (error) {
      setMessage(error?.message || "Could not start your pre-order payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!product) {
    return <Page><Text style={styles.title}>Product not available</Text><Button title="Go back" onPress={goBack} /></Page>;
  }

  if (confirmed) {
    return <Page>
      <Text style={styles.eyebrow}>PRE-ORDER CONFIRMED</Text>
      <Text style={styles.title}>Thank you for your pre-order</Text>
      <Notice tone="success">
        {confirmed.orderNumber ? "Order #" + confirmed.orderNumber + " has been confirmed. " : "Your pre-order has been confirmed. "}
        {confirmed.purpose === "cod_advance"
          ? money(confirmed.advancePaid) + " received. " + money(confirmed.balanceDue) + " remains payable on delivery."
          : "Your full payment has been verified."}
      </Notice>
      <Button title="Continue shopping" onPress={() => navigate("home")} />
      <Button title="View my orders" secondary onPress={() => navigate("orders")} />
    </Page>;
  }

  if (payment) {
    return <Page>
      <Text style={styles.eyebrow}>SECURE PRE-ORDER PAYMENT</Text>
      <Text style={styles.title}>Complete your payment</Text>
      <Notice>
        Pre-order for {product.name}. Your order is confirmed only after Fonepay verifies the payment.
      </Notice>
      <FonepayPaymentPanel payment={payment} session={session} purpose={payment.purpose} title="Pay securely with Fonepay" />
      <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
      <Text style={styles.small}>Waiting for Fonepay confirmation…</Text>
    </Page>;
  }

  return <Page>
    <Text onPress={goBack} style={styles.back}>‹  Back to product</Text>
    <Text style={styles.eyebrow}>SURU COLLECTION</Text>
    <Text style={styles.title}>Pre-order</Text>
    <Text style={styles.productName}>{product.name}</Text>
    <Text style={styles.productMeta}>
      {[size && "Size: " + size, color && "Colour: " + color, "Quantity: " + qty].filter(Boolean).join("  ·  ")}
    </Text>

    {!!profile && <Notice>Signed in as {profile.name || session?.user?.email}. Your saved details have been filled where available.</Notice>}
    <Field label="Full name" value={form.name} onChangeText={(value) => update("name", value)} />
    <Field label="Mobile number" value={form.phone} onChangeText={(value) => update("phone", value)} keyboardType="phone-pad" />
    <Field label="Delivery address" value={form.address} onChangeText={(value) => update("address", value)} multiline />
    <NepalLocationFields
      province={form.province}
      district={form.district}
      city={form.city}
      onProvinceChange={(value) => { setForm((current) => ({ ...current, province: value, district: "", city: "" })); setBranch(""); }}
      onDistrictChange={(value) => { setForm((current) => ({ ...current, district: value, city: "" })); setBranch(""); }}
      onCityChange={(value) => { update("city", value); setBranch(""); }}
    />
    <Field label="Postal code (optional)" value={form.postal_code} onChangeText={(value) => update("postal_code", value)} keyboardType="number-pad" />

    <Text style={styles.pickerLabel}>NCM destination branch</Text>
    <View style={styles.pickerBox}>
      {branchBusy ? <ActivityIndicator color={colors.primary} style={{ padding: 16 }} /> : (
        <Picker selectedValue={branch} onValueChange={setBranch}>
          <Picker.Item label="Select destination branch" value="" />
          {branchOptions.map((item) => (
            <Picker.Item
              key={String(item.code || item.pk || item.name)}
              label={item.name + (item.municipality ? " · " + item.municipality : "")}
              value={item.name}
            />
          ))}
        </Picker>
      )}
    </View>
    {rateBusy && <Notice>Calculating live NCM delivery charge…</Notice>}
    {!!rateError && <Notice tone="error">{rateError}</Notice>}

    <Text style={styles.pickerLabel}>Payment option</Text>
    <View style={styles.pickerBox}>
      <Picker selectedValue={paymentPurpose} onValueChange={setPaymentPurpose}>
        <Picker.Item label={"Cash on Delivery — pay " + advancePercent + "% advance"} value="cod_advance" />
        <Picker.Item label="Full payment now" value="full" />
      </Picker>
    </View>

    <Field label="Order note (optional)" value={form.note} onChangeText={(value) => update("note", value)} multiline />

    <View style={styles.summary}>
      <Text style={styles.summaryLine}>Product total after 5% pre-order discount   {money(productAmount)}</Text>
      <View style={styles.summaryLineRow}>
        <Text style={styles.summaryLine}>NCM delivery charge</Text>
        <Text style={styles.summaryValue}>{quoteMatchesBranch ? money(deliveryFee) : "Awaiting quote"}</Text>
      </View>
      <View style={styles.summaryTotal}>
        <Text style={styles.summaryTotalLabel}>Estimated total</Text>
        <Text style={styles.summaryTotalValue}>{money(estimatedTotal)}</Text>
      </View>
      <View style={styles.summaryLineRow}>
        <Text style={styles.summaryLine}>Pay now</Text>
        <Text style={styles.summaryPayNow}>{quoteMatchesBranch ? money(payNow) : "Awaiting quote"}</Text>
      </View>
      {paymentPurpose === "cod_advance" && (
        <Text style={styles.summaryLine}>Remaining on delivery: {quoteMatchesBranch ? money(balanceOnDelivery) : "—"}</Text>
      )}
    </View>

    {!!message && <Notice tone="error">{message}</Notice>}
    <Button
      title={submitting ? "Starting pre-order…" : "Continue to Fonepay"}
      onPress={submitPreorder}
      loading={submitting}
      disabled={!session?.user || branchBusy || !quoteMatchesBranch || rateBusy || submitting}
    />
    {!session?.user && <Button title="Sign in to pre-order" secondary onPress={() => navigate("auth", {
      returnRoute: { name: "preorder", params: { productId, size, color, quantity: qty } }
    })} />}
  </Page>;
}

const styles = {
  back: { color: colors.primary, fontWeight: "700", marginBottom: 16 },
  eyebrow: { color: colors.accent, fontSize: 9, letterSpacing: 1.8, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 27, fontWeight: "800", marginTop: 5, marginBottom: 8 },
  productName: { color: colors.ink, fontSize: 15, fontWeight: "800", marginTop: 4 },
  productMeta: { color: colors.muted, fontSize: 11, marginTop: 5, marginBottom: 13 },
  pickerLabel: { color: colors.ink, fontSize: 12, fontWeight: "700", marginBottom: 5, marginTop: 10 },
  pickerBox: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: 12, overflow: "hidden" },
  summary: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: 15, marginTop: 16 },
  summaryLine: { color: colors.muted, fontSize: 11, lineHeight: 17, marginVertical: 4 },
  summaryLineRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryValue: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  summaryTotal: { borderTopWidth: 1, borderColor: colors.border, marginTop: 10, paddingTop: 12, flexDirection: "row", justifyContent: "space-between" },
  summaryTotalLabel: { color: colors.ink, fontWeight: "800" },
  summaryTotalValue: { color: colors.primary, fontSize: 16, fontWeight: "900" },
  summaryPayNow: { color: colors.primary, fontSize: 15, fontWeight: "900" },
  small: { color: colors.muted, textAlign: "center", fontSize: 11, lineHeight: 17, marginTop: 8 }
};
