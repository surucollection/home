import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import QRCode from "react-native-qrcode-svg";
import { useStore } from "../StoreContext";
import { supabase } from "../lib/supabase";
import { money, normalizeNepalPhone, isNepalMobile, canonicalProvince, provinces, randomIdempotencyKey } from "../lib/format";
import { Button, Field, Notice, Page } from "../components/UI";
import { colors, radius } from "../theme";

export default function CheckoutScreen({ goBack, onComplete }) {
  const { cartItems, cartSubtotal, session, profile, clearCart } = useStore();
  const checkoutKey = useRef(randomIdempotencyKey());
  const [form, setForm] = useState({
    name: profile?.name || "",
    phone: profile?.phone || "",
    email: session?.user?.email || "",
    address: profile?.address || "",
    city: profile?.city || "",
    district: profile?.district || "",
    province: canonicalProvince(profile?.province || ""),
    postal_code: profile?.postal_code || "",
    destination_branch: profile?.ncm_destination_branch || ""
  });
  const [branches, setBranches] = useState([]);
  const [branchBusy, setBranchBusy] = useState(true);
  const [rate, setRate] = useState(null);
  const [rateBusy, setRateBusy] = useState(false);
  const [rateError, setRateError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("fonepay");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [payment, setPayment] = useState(null);
  const [paid, setPaid] = useState(null);
  const [expired, setExpired] = useState(false);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!profile?.id) return;
    setForm((current) => ({
      ...current,
      name: current.name || profile.name || "",
      phone: current.phone || profile.phone || "",
      email: current.email || session?.user?.email || "",
      address: current.address || profile.address || "",
      city: current.city || profile.city || "",
      district: current.district || profile.district || "",
      province: current.province || canonicalProvince(profile.province || ""),
      postal_code: current.postal_code || profile.postal_code || "",
      destination_branch: current.destination_branch || profile.ncm_destination_branch || ""
    }));
  }, [profile?.id]);

  useEffect(() => {
    let active = true;
    supabase.functions.invoke("ncm-branches").then(({ data, error }) => {
      if (error) throw error;
      const list = Array.isArray(data) ? data : data?.branches || [];
      if (active) setBranches(list);
    }).catch((error) => { if (active) setMessage(error?.message || "NCM branches could not be loaded."); })
      .finally(() => { if (active) setBranchBusy(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!form.destination_branch) { setRate(null); setRateError(""); return; }
    let active = true;
    setRateBusy(true);
    setRateError("");
    supabase.functions.invoke("ncm-rate", { body: { destinationBranch: form.destination_branch } })
      .then(({ data, error }) => {
        if (error) throw error;
        if (data?.error || data?.ok === false) throw new Error(data.error || "NCM could not return a delivery rate.");
        if (active) setRate(data);
      })
      .catch((error) => { if (active) { setRate(null); setRateError(error?.message || "Unable to calculate delivery charge."); } })
      .finally(() => { if (active) setRateBusy(false); });
    return () => { active = false; };
  }, [form.destination_branch]);

  const rateValid = !!(
    rate && !rateBusy &&
    String(rate.destinationBranch || "").trim().toUpperCase() === String(form.destination_branch || "").trim().toUpperCase() &&
    Number(rate.advanceDeliveryCharge) > 0
  );
  const discountAmount = Math.min(cartSubtotal, Math.max(0, Number(coupon?.discount_amount || 0)));
  const shipping = coupon?.free_shipping ? 0 : rateValid ? Number(rate.advanceDeliveryCharge || 0) : 0;
  const estimatedTotal = Math.max(0, cartSubtotal - discountAmount + shipping);

  async function applyCoupon() {
    if (!couponCode.trim()) { setCoupon(null); setMessage("Enter a coupon code."); return; }
    setCouponBusy(true);
    setMessage("");
    try {
      const { data, error } = await supabase.rpc("validate_discount_coupon", {
        p_code: couponCode.trim(),
        p_subtotal: Math.round(cartSubtotal)
      });
      if (error) throw error;
      if (!data?.valid) { setCoupon(null); throw new Error(data?.message || "This coupon cannot be applied."); }
      setCoupon(data);
      setMessage("Coupon " + data.code + " applied.");
    } catch (error) {
      setCoupon(null);
      setMessage(error?.message || "Unable to validate coupon.");
    } finally {
      setCouponBusy(false);
    }
  }

  async function createOrder() {
    if (busy || payment) return;
    if (!cartItems.length) return setMessage("Your shopping bag is empty.");
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim() || !form.city.trim() || !form.district.trim() || !form.province.trim()) {
      return setMessage("Complete your name, phone and delivery address.");
    }
    if (!isNepalMobile(normalizeNepalPhone(form.phone))) return setMessage("Enter a valid Nepal mobile number.");
    if (!form.destination_branch) return setMessage("Select your NCM destination branch.");
    if (!rateValid) return setMessage(rateError || "Wait for the selected branch's delivery charge to load.");
    if (cartItems.some((item) => !item.product)) return setMessage("One of the products in your bag is no longer available.");
    setBusy(true);
    setMessage("");
    try {
      const customer = {
        name: form.name.trim(),
        phone: normalizeNepalPhone(form.phone),
        email: form.email.trim().toLowerCase(),
        address: form.address.trim(),
        city: form.city.trim(),
        district: form.district.trim(),
        province: canonicalProvince(form.province),
        postal_code: form.postal_code.trim() || null,
        ncm_destination_branch: form.destination_branch
      };
      const items = cartItems.map((line) => ({
        code: String(line.product.product_code || "").trim(),
        size: line.size || null,
        color: line.color || null,
        qty: Math.max(1, Number(line.quantity || 1))
      }));
      const { data, error } = await supabase.rpc("place_order", {
        p_customer: customer,
        p_items: items,
        p_payment_method: paymentMethod,
        p_customer_note: null,
        p_coupon_code: coupon?.code || null,
        p_checkout_idempotency_key: checkoutKey.current
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const orderId = data?.order_id || data?.order?.id;
      const orderNumber = data?.order_number || "";
      if (!orderId) throw new Error("The server did not return an order ID. Please contact Suru Collection before trying again.");
      if (paymentMethod === "cod" || paymentMethod === "fonepay") {
        const purpose = paymentMethod === "cod" ? "cod_advance" : "full";
        const expected = purpose === "cod_advance" ? Number(data?.cod_advance_required) : Number(data?.total);
        if (!Number.isFinite(expected) || expected <= 0) {
          if (purpose === "cod_advance") throw new Error("The COD advance amount was not returned. Please contact Suru Collection.");
          throw new Error("The Fonepay order total was not returned.");
        }
        const guestCheckoutKey = session?.user ? "" : checkoutKey.current;
        const { data: paymentData, error: paymentError } = await supabase.functions.invoke("fonepay-payment", {
          body: { action: "create", orderId, purpose, guestCheckoutKey }
        });
        if (paymentError) throw paymentError;
        if (paymentData?.error) throw new Error(paymentData.error);
        if (paymentData?.expired) throw new Error("The payment window has expired. Please place a new order.");
        if (paymentData?.alreadyPaid) {
          await clearCart();
          setPaid({ orderNumber: paymentData.orderNumber || orderNumber, purpose, balanceDue: paymentData.balanceDue || 0 });
          return;
        }
        const amount = Number(paymentData?.amount);
        if (!paymentData?.qrString || !Number.isFinite(amount) || Math.abs(amount - expected) > 0.01) {
          throw new Error("Fonepay returned an invalid QR or amount. Do not retry by creating another order. Contact Suru Collection with order " + orderNumber + ".");
        }
        setPayment({
          orderId, orderNumber, amount, purpose,
          guestCheckoutKey,
          qrString: paymentData.qrString,
          expiresAt: paymentData.paymentExpiresAt || null,
          balanceDue: Number(paymentData.balanceDue || 0)
        });
      } else {
        await clearCart();
        setPaid({ orderNumber, purpose: "cod", balanceDue: Number(data?.cod_balance_due || data?.total || 0) });
      }
    } catch (error) {
      setMessage(error?.message || "Checkout could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!payment?.orderId) return;
    let stopped = false;
    let timer;
    const check = async () => {
      if (stopped) return;
      try {
        const { data, error } = await supabase.functions.invoke("fonepay-payment", {
          body: {
            action: "status",
            orderId: payment.orderId,
            purpose: payment.purpose,
            guestCheckoutKey: payment.guestCheckoutKey || ""
          }
        });
        if (stopped || error || !data) return;
        if (data.expired) {
          stopped = true;
          setExpired(true);
          setPayment(null);
          return;
        }
        if (data.verified) {
          stopped = true;
          await clearCart();
          setPaid({
            orderNumber: data.orderNumber || payment.orderNumber,
            purpose: payment.purpose,
            balanceDue: Number(data.balanceDue || payment.balanceDue || 0)
          });
          setPayment(null);
        }
      } catch (error) {
        console.warn("Fonepay status check failed:", error?.message || error);
      }
    };
    check();
    timer = setInterval(check, 5000);
    return () => { stopped = true; if (timer) clearInterval(timer); };
  }, [payment?.orderId]);

  if (paid) return <Page>
    <Text style={styles.eyebrow}>THANK YOU</Text>
    <Text style={styles.title}>Order placed successfully</Text>
    <Notice tone="success">Order {paid.orderNumber ? "#" + paid.orderNumber : ""} is confirmed. {paid.purpose === "cod_advance" ? "Your remaining COD balance is " + money(paid.balanceDue) + "." : "Fonepay payment has been verified."}</Notice>
    <Button title="Continue shopping" onPress={onComplete} />
  </Page>;

  if (payment) return <Page>
    <Text style={styles.eyebrow}>SECURE PAYMENT</Text>
    <Text style={styles.title}>Scan with Fonepay</Text>
    <Notice>Order {payment.orderNumber ? "#" + payment.orderNumber : ""}. Pay {money(payment.amount)} using your banking or wallet app. This screen checks payment status automatically.</Notice>
    <View style={styles.qrWrap}><QRCode value={payment.qrString} size={220} /></View>
    <Text style={styles.qrAmount}>{money(payment.amount)}</Text>
    {!!payment.balanceDue && payment.purpose === "cod_advance" && <Text style={styles.small}>Remaining COD balance: {money(payment.balanceDue)}</Text>}
    <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
    <Text style={styles.small}>Waiting for payment confirmation…</Text>
  </Page>;

  if (expired) return <Page>
    <Text style={styles.title}>Payment window expired</Text>
    <Notice tone="error">The server has expired this payment attempt. Please check My Orders before placing another order.</Notice>
    <Button title="View my orders" onPress={() => onComplete?.("orders")} />
  </Page>;

  return <Page>
    <Text onPress={goBack} style={styles.back}>‹  Back to bag</Text>
    <Text style={styles.eyebrow}>FINAL STEP</Text>
    <Text style={styles.title}>Delivery & payment</Text>
    {!!profile && <Notice>Signed in as {profile.name || session?.user?.email}. Your saved details have been filled where available.</Notice>}
    <Field label="Full name" value={form.name} onChangeText={(v) => update("name", v)} />
    <Field label="Mobile number" value={form.phone} onChangeText={(v) => update("phone", v)} keyboardType="phone-pad" />
    <Field label="Email (optional)" value={form.email} onChangeText={(v) => update("email", v)} keyboardType="email-address" autoCapitalize="none" />
    <Field label="Delivery address" value={form.address} onChangeText={(v) => update("address", v)} multiline />
    <Field label="City / Municipality" value={form.city} onChangeText={(v) => update("city", v)} />
    <Field label="District" value={form.district} onChangeText={(v) => update("district", v)} />
    <Text style={styles.pickerLabel}>Province</Text>
    <View style={styles.pickerBox}><Picker selectedValue={form.province} onValueChange={(v) => update("province", v)}><Picker.Item label="Select province" value="" />{provinces.map((item) => <Picker.Item key={item} label={item} value={item} />)}</Picker></View>
    <Field label="Postal code (optional)" value={form.postal_code} onChangeText={(v) => update("postal_code", v)} keyboardType="number-pad" />
    <Text style={styles.pickerLabel}>NCM destination branch</Text>
    <View style={styles.pickerBox}>
      {branchBusy ? <ActivityIndicator color={colors.primary} style={{ padding: 16 }} /> :
        <Picker selectedValue={form.destination_branch} onValueChange={(v) => { update("destination_branch", v); setCoupon(null); }}>
          <Picker.Item label="Select destination branch" value="" />
          {branches.map((branch) => <Picker.Item key={String(branch.code || branch.pk || branch.name)} label={branch.name + (branch.municipality ? " · " + branch.municipality : "")} value={branch.name} />)}
        </Picker>}
    </View>
    {rateBusy && <Notice>Calculating live delivery charge…</Notice>}
    {!!rateError && <Notice tone="error">{rateError}</Notice>}
    {rateValid && <View style={styles.shippingLine}><Text style={styles.small}>NCM delivery charge</Text><Text style={styles.shippingPrice}>{money(rate.advanceDeliveryCharge)}</Text></View>}
    <Text style={styles.label}>Discount coupon</Text>
    <Field value={couponCode} onChangeText={setCouponCode} placeholder="Enter coupon code" autoCapitalize="characters" />
    <Button title="Apply coupon" secondary onPress={applyCoupon} loading={couponBusy} />
    {!!coupon && <Notice tone="success">Coupon {coupon.code} applied{coupon.free_shipping ? " with free shipping" : ""}.</Notice>}
    <Text style={styles.label}>Payment method</Text>
    <View style={styles.paymentChoices}>
      <Text onPress={() => setPaymentMethod("fonepay")} style={[styles.paymentChoice, paymentMethod === "fonepay" && styles.paymentChoiceActive]}>Fonepay QR</Text>
      <Text onPress={() => setPaymentMethod("cod")} style={[styles.paymentChoice, paymentMethod === "cod" && styles.paymentChoiceActive]}>Cash on delivery</Text>
    </View>
    <View style={styles.summary}>
      <Text style={styles.summaryLine}>Subtotal   {money(cartSubtotal)}</Text>
      {!!discountAmount && <Text style={styles.summaryLine}>Discount   −{money(discountAmount)}</Text>}
      <Text style={styles.summaryLine}>Delivery   {rateValid ? money(shipping) : "Calculated at checkout"}</Text>
      <View style={styles.summaryTotal}><Text style={styles.summaryTotalLabel}>Estimated total</Text><Text style={styles.summaryTotalPrice}>{money(estimatedTotal)}</Text></View>
    </View>
    {!!message && <Notice tone={/could not|unable|valid|select|enter|complete|expired|failed/i.test(message) ? "error" : "info"}>{message}</Notice>}
    <Button title={paymentMethod === "cod" ? "Place COD order & pay advance" : "Continue to Fonepay"} onPress={createOrder} loading={busy} disabled={!cartItems.length || branchBusy || !rateValid || rateBusy} />
    <Text style={styles.disclaimer}>Order pricing, stock checks, coupons, COD advance and payment verification are rechecked by the Suru Collection server. Card checkout and native preorder payment are not included in this first mobile build.</Text>
  </Page>;
}

const styles = {
  back: { color: colors.primary, fontWeight: "700", marginBottom: 18 },
  eyebrow: { color: colors.accent, fontSize: 9, letterSpacing: 1.8, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 27, fontWeight: "800", marginTop: 5, marginBottom: 8 },
  pickerLabel: { color: colors.ink, fontSize: 12, fontWeight: "700", marginBottom: 5 },
  pickerBox: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: 12, overflow: "hidden" },
  shippingLine: { flexDirection: "row", justifyContent: "space-between", padding: 12, backgroundColor: colors.surfaceSoft, borderRadius: 10, marginBottom: 12 },
  shippingPrice: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  label: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: 14, marginBottom: 8 },
  paymentChoices: { flexDirection: "row", gap: 8 },
  paymentChoice: { flex: 1, textAlign: "center", overflow: "hidden", color: colors.primary, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 12, fontWeight: "700", fontSize: 11 },
  paymentChoiceActive: { backgroundColor: colors.primary, color: colors.white, borderColor: colors.primary },
  summary: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: 15, marginTop: 18 },
  summaryLine: { color: colors.muted, fontSize: 12, marginVertical: 4 },
  summaryTotal: { borderTopWidth: 1, borderColor: colors.border, marginTop: 10, paddingTop: 12, flexDirection: "row", justifyContent: "space-between" },
  summaryTotalLabel: { color: colors.ink, fontWeight: "800" },
  summaryTotalPrice: { color: colors.primary, fontSize: 17, fontWeight: "900" },
  qrWrap: { backgroundColor: colors.white, alignSelf: "center", padding: 18, borderRadius: radius.md, marginTop: 28 },
  qrAmount: { color: colors.primary, textAlign: "center", fontSize: 22, fontWeight: "900", marginTop: 16 },
  small: { color: colors.muted, textAlign: "center", fontSize: 11, lineHeight: 17, marginTop: 8 },
  disclaimer: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 14, textAlign: "center" }
};