import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import FonepayPaymentPanel from "../components/FonepayPaymentPanel";
import { useStore } from "../StoreContext";
import { supabase } from "../lib/supabase";
import { money, normalizeNepalPhone, isNepalMobile, canonicalProvince, provinces, randomIdempotencyKey } from "../lib/format";
import { Button, Field, Notice, Page } from "../components/UI";
import NepalLocationFields from "../components/NepalLocationFields";
import NcmBranchDropdown from "../components/NcmBranchDropdown";
import { resolveNcmBranch } from "../lib/ncmBranchResolver";
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
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [addressStep, setAddressStep] = useState("address");
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [addressLabel, setAddressLabel] = useState("Home");
  const [saveAddress, setSaveAddress] = useState(Boolean(session?.user));
  const [editingAddressId, setEditingAddressId] = useState("");
  const [addressBusy, setAddressBusy] = useState(false);
  const [addressLoading, setAddressLoading] = useState(true);

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
    let active = true;
    async function loadCustomerAddresses() {
      setAddressLoading(true);
      try {
        if (!session?.user) {
          if (active) {
            setSavedAddresses([]);
            setSelectedAddressId("");
            setSelectedAddress(null);
            setAddressFormOpen(true);
            setSaveAddress(false);
          }
          return;
        }
        const { data: customer, error: customerError } = await supabase.rpc("my_customer_profile");
        if (customerError) throw customerError;
        if (!customer?.id) {
          if (active) {
            setAddressFormOpen(true);
            setSaveAddress(true);
          }
          return;
        }
        const { data, error } = await supabase
          .from("customer_addresses")
          .select("id,customer_id,label,full_name,phone,address,city,district,province,postal_code,is_default,created_at,updated_at")
          .eq("customer_id", customer.id)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: true });
        if (error) throw error;
        if (!active) return;
        const rows = Array.isArray(data) ? data : [];
        setSavedAddresses(rows);
        if (rows.length) {
          const preferred = rows.find((item) => item.is_default) || rows[0];
          setSelectedAddressId(preferred.id);
          setSelectedAddress(preferred);
          setForm((current) => ({
            ...current,
            name: preferred.full_name || customer.name || current.name,
            phone: preferred.phone || customer.phone || current.phone,
            email: current.email || session.user.email || "",
            address: preferred.address || "",
            city: preferred.city || "",
            district: preferred.district || "",
            province: canonicalProvince(preferred.province || ""),
            postal_code: preferred.postal_code || "",
            destination_branch: ""
          }));
          setAddressFormOpen(false);
        } else {
          setSelectedAddressId("");
          setSelectedAddress(null);
          setAddressFormOpen(true);
          setSaveAddress(true);
          setForm((current) => ({
            ...current,
            name: current.name || customer.name || "",
            phone: current.phone || customer.phone || "",
            email: current.email || session.user.email || "",
            address: current.address || customer.address || "",
            city: current.city || customer.city || "",
            district: current.district || customer.district || "",
            province: current.province || canonicalProvince(customer.province || ""),
            postal_code: current.postal_code || customer.postal_code || "",
            destination_branch: ""
          }));
        }
      } catch (error) {
        if (active) {
          setAddressFormOpen(true);
          setSaveAddress(Boolean(session?.user));
          setMessage(error?.message || "Saved addresses could not be loaded. You can still enter a new address.");
        }
      } finally {
        if (active) setAddressLoading(false);
      }
    }
    loadCustomerAddresses();
    return () => { active = false; };
  }, [session?.user?.id]);

  const branchResolution = useMemo(() => resolveNcmBranch(branches, {
    province: form.province,
    district: form.district,
    city: form.city,
    address: form.address
  }), [branches, form.province, form.district, form.city, form.address]);
  const branchOptions = branchResolution.candidates;

  // When there is one strong match, preselect it automatically just like the website.
  // A customer can still open the dropdown and select any other candidate in the same district.
  useEffect(() => {
    if (!form.destination_branch && branchResolution.branch) {
      setForm((current) => current.destination_branch
        ? current
        : { ...current, destination_branch: branchResolution.branch });
    }
  }, [branchResolution.branch, form.destination_branch]);

  function chooseSavedAddress(address) {
    setSelectedAddressId(address.id);
    setSelectedAddress(address);
    setEditingAddressId("");
    setAddressFormOpen(false);
    setForm((current) => ({
      ...current,
      name: address.full_name || "",
      phone: address.phone || "",
      address: address.address || "",
      city: address.city || "",
      district: address.district || "",
      province: canonicalProvince(address.province || ""),
      postal_code: address.postal_code || "",
      destination_branch: ""
    }));
    setMessage("");
  }

  function startNewAddress() {
    setSelectedAddressId("");
    setSelectedAddress(null);
    setEditingAddressId("");
    setAddressLabel("Home");
    setAddressFormOpen(true);
    setSaveAddress(Boolean(session?.user));
    setForm((current) => ({
      ...current,
      name: profile?.name || current.name || "",
      phone: profile?.phone || current.phone || "",
      email: session?.user?.email || current.email || "",
      address: profile?.address || "",
      city: profile?.city || "",
      district: profile?.district || "",
      province: canonicalProvince(profile?.province || ""),
      postal_code: profile?.postal_code || "",
      destination_branch: ""
    }));
    setMessage("");
  }

  function editSelectedAddress() {
    if (!selectedAddress) return startNewAddress();
    setEditingAddressId(selectedAddress.id);
    setAddressLabel(selectedAddress.label || "Home");
    setAddressFormOpen(true);
    setSaveAddress(true);
    setAddressStep("address");
  }

  async function continueFromAddress() {
    if (addressBusy) return;
    if (!addressFormOpen) {
      if (!selectedAddress) return setMessage("Choose a saved address or add a new one.");
      setAddressStep("delivery");
      setMessage("");
      return;
    }
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim() ||
        !form.city.trim() || !form.district.trim() || !form.province.trim()) {
      return setMessage("Complete your name, phone and delivery address.");
    }
    if (!isNepalMobile(normalizeNepalPhone(form.phone))) {
      return setMessage("Enter a valid Nepal mobile number.");
    }

    const addressDraft = {
      label: addressLabel.trim() || "Home",
      full_name: form.name.trim(),
      phone: normalizeNepalPhone(form.phone),
      address: form.address.trim(),
      city: form.city.trim(),
      district: form.district.trim(),
      province: canonicalProvince(form.province),
      postal_code: form.postal_code.trim() || null
    };

    if (saveAddress && session?.user) {
      setAddressBusy(true);
      try {
        const { data, error } = await supabase.rpc("save_customer_address", {
          p_address_id: editingAddressId || null,
          p_label: addressDraft.label,
          p_full_name: addressDraft.full_name,
          p_phone: addressDraft.phone,
          p_address: addressDraft.address,
          p_city: addressDraft.city,
          p_district: addressDraft.district,
          p_province: addressDraft.province,
          p_postal_code: addressDraft.postal_code,
          p_is_default: savedAddresses.length === 0 || Boolean(editingAddressId && selectedAddress?.is_default)
        });
        if (error) throw error;
        const { data: customer } = await supabase.rpc("my_customer_profile");
        let rows = [];
        if (customer?.id) {
          const result = await supabase.from("customer_addresses")
            .select("id,customer_id,label,full_name,phone,address,city,district,province,postal_code,is_default,created_at,updated_at")
            .eq("customer_id", customer.id)
            .order("is_default", { ascending: false })
            .order("created_at", { ascending: true });
          if (result.error) throw result.error;
          rows = result.data || [];
        }
        const chosen = rows.find((item) => item.id === (data?.id || editingAddressId)) || data || addressDraft;
        setSavedAddresses(rows);
        setSelectedAddress(chosen);
        setSelectedAddressId(chosen.id || "");
        setForm((current) => ({
          ...current, name: chosen.full_name || addressDraft.full_name,
          phone: chosen.phone || addressDraft.phone, address: chosen.address || addressDraft.address,
          city: chosen.city || addressDraft.city, district: chosen.district || addressDraft.district,
          province: chosen.province || addressDraft.province, postal_code: chosen.postal_code || addressDraft.postal_code
        }));
      } catch (error) {
        setMessage(error?.message || "Address could not be saved. Turn off Save address to continue without saving.");
        setAddressBusy(false);
        return;
      } finally {
        setAddressBusy(false);
      }
    } else {
      setSelectedAddress({ ...addressDraft, id: "" });
      setSelectedAddressId("");
    }

    setAddressFormOpen(false);
    setEditingAddressId("");
    setAddressStep("delivery");
    setMessage("");
  }

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
        if (paymentData?.alreadyPaid === true) {
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
          qrMessage: paymentData.qrMessage || null,
          reference: paymentData.reference || null,
          expiresAt: paymentData.paymentExpiresAt || null,
          balanceDue: Number(paymentData.balanceDue || 0)
        });
      } else {
        throw new Error("Unsupported payment option. Choose Fonepay or Cash on delivery.");
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
        if (data.verified === true) {
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
    <Notice tone="success">Order {paid.orderNumber ? "#" + paid.orderNumber : ""} is confirmed. {paid.purpose === "cod_advance" ? "Your COD advance payment has been verified. Remaining balance payable on delivery: " + money(paid.balanceDue) + "." : "Fonepay payment has been verified."}</Notice>
    <Button title="Continue shopping" onPress={onComplete} />
  </Page>;

  if (payment) return <Page>
    <Text style={styles.eyebrow}>SECURE PAYMENT</Text>
    <Text style={styles.title}>Complete your payment</Text>
    <Notice>Order {payment.orderNumber ? "#" + payment.orderNumber : ""}. Choose a supported bank app or scan the QR. {payment.purpose === "cod_advance" ? "Your COD order stays unconfirmed until the advance payment is successfully verified." : "Payment is verified automatically."}</Notice>
    <FonepayPaymentPanel payment={payment} session={session} purpose={payment.purpose} />
    <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
    <Text style={styles.small}>Waiting for payment confirmation…</Text>
  </Page>;

  if (expired) return <Page>
    <Text style={styles.title}>Payment window expired</Text>
    <Notice tone="error">The server has expired this payment attempt. Please check My Orders before placing another order.</Notice>
    <Button title="View my orders" onPress={() => onComplete?.("orders")} />
  </Page>;

  return <Page>
    {addressStep === "address" ? <>
      <Text onPress={goBack} style={styles.back}>‹  Back to bag</Text>
      <Text style={styles.eyebrow}>DELIVERY ADDRESS</Text>
      <Text style={styles.title}>Choose your address</Text>
      <Text style={styles.subtitle}>Select a saved delivery address or add a new one to continue.</Text>
      {!!message && <Notice tone="error">{message}</Notice>}
      {addressLoading && <Notice>Loading your saved addresses…</Notice>}
      {!addressLoading && !addressFormOpen && savedAddresses.map((address) => {
        const active = selectedAddressId === address.id;
        return <Pressable key={address.id} onPress={() => chooseSavedAddress(address)} style={[styles.addressCard, active && styles.addressCardActive]}>
          <View style={styles.addressCardHeader}>
            <Text style={styles.addressLabel}>{address.label || "Address"}</Text>
            {address.is_default && <Text style={styles.defaultLabel}>DEFAULT</Text>}
            <View style={[styles.radio, active && styles.radioActive]} />
          </View>
          <Text style={styles.addressName}>{address.full_name}</Text>
          <Text style={styles.addressText}>{address.phone}</Text>
          <Text style={styles.addressText}>{[address.address,address.city,address.district,address.province,address.postal_code].filter(Boolean).join(", ")}</Text>
          {active && <Pressable onPress={editSelectedAddress} style={styles.editAddress}><Text style={styles.editAddressText}>Edit this address</Text></Pressable>}
        </Pressable>;
      })}
      {!addressLoading && !addressFormOpen && savedAddresses.length > 0 && <>
        <Button title="Continue with selected address" onPress={continueFromAddress} disabled={!selectedAddressId} />
        <Button title="Add a new address" secondary onPress={startNewAddress} />
      </>}
      {!addressLoading && (addressFormOpen || !savedAddresses.length) && <>
        <Text style={styles.sectionTitle}>{editingAddressId ? "Edit delivery address" : "New delivery address"}</Text>
        <Field label="Address label" value={addressLabel} onChangeText={setAddressLabel} placeholder="Home, Office, Family" />
        <Field label="Full name" value={form.name} onChangeText={(v) => update("name", v)} />
        <Field label="Mobile number" value={form.phone} onChangeText={(v) => update("phone", v)} keyboardType="phone-pad" />
        <Field label="Email (optional)" value={form.email} onChangeText={(v) => update("email", v)} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Delivery address" value={form.address} onChangeText={(v) => { update("address", v); update("destination_branch", ""); }} multiline />
        <NepalLocationFields
          province={form.province}
          district={form.district}
          city={form.city}
          onProvinceChange={(v) => setForm((current) => ({ ...current, province: v, district: "", city: "", destination_branch: "" }))}
          onDistrictChange={(v) => setForm((current) => ({ ...current, district: v, city: "", destination_branch: "" }))}
          onCityChange={(v) => setForm((current) => ({ ...current, city: v, destination_branch: "" }))}
        />
        <Field label="Postal code (optional)" value={form.postal_code} onChangeText={(v) => update("postal_code", v)} keyboardType="number-pad" />
        {!!session?.user && <Pressable onPress={() => setSaveAddress((value) => !value)} style={styles.saveAddressRow}>
          <View style={[styles.checkbox, saveAddress && styles.checkboxActive]} />
          <Text style={styles.saveAddressText}>Save this address to my account</Text>
        </Pressable>}
        <Button title={addressBusy ? "Saving address…" : "Continue with this address"} onPress={continueFromAddress} loading={addressBusy} />
        {savedAddresses.length > 0 && <Button title="Choose a saved address" secondary onPress={() => { setAddressFormOpen(false); setEditingAddressId(""); setMessage(""); }} />}
      </>}
    </> : <>
      <Text onPress={() => setAddressStep("address")} style={styles.back}>‹  Change address</Text>
      <Text style={styles.eyebrow}>FINAL STEP</Text>
      <Text style={styles.title}>Delivery & payment</Text>
      {!!selectedAddress && <View style={styles.selectedAddressCard}>
        <View style={styles.addressCardHeader}>
          <Text style={styles.addressLabel}>{selectedAddress.label || "Delivery address"}</Text>
          <Text style={styles.defaultLabel}>SELECTED</Text>
        </View>
        <Text style={styles.addressName}>{selectedAddress.full_name || form.name}</Text>
        <Text style={styles.addressText}>{selectedAddress.phone || form.phone}</Text>
        <Text style={styles.addressText}>{[selectedAddress.address || form.address, selectedAddress.city || form.city, selectedAddress.district || form.district, selectedAddress.province || form.province, selectedAddress.postal_code || form.postal_code].filter(Boolean).join(", ")}</Text>
      </View>}
      <Field label="Email (optional)" value={form.email} onChangeText={(v) => update("email", v)} keyboardType="email-address" autoCapitalize="none" />
      <Text style={styles.pickerLabel}>NCM destination branch</Text>
      {branchBusy
        ? <View style={styles.pickerBox}><ActivityIndicator color={colors.primary} style={{ padding: 16 }} /></View>
        : <NcmBranchDropdown
            value={form.destination_branch}
            options={branchOptions}
            disabled={!form.district || !branchOptions.length}
            onSelect={(value) => { update("destination_branch", value); setCoupon(null); }}
          />}
      {!!branchResolution.message && !branchBusy && <Text style={styles.branchMatchMessage}>{branchResolution.message}</Text>}
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
      {paymentMethod === "cod" && <Notice>COD requires an advance payment through Fonepay. Your order will be confirmed only after Fonepay verifies the exact advance amount. The remaining balance is payable on delivery.</Notice>}
      <View style={styles.summary}>
        <Text style={styles.summaryLine}>Subtotal   {money(cartSubtotal)}</Text>
        {!!discountAmount && <Text style={styles.summaryLine}>Discount   −{money(discountAmount)}</Text>}
        <Text style={styles.summaryLine}>Delivery   {rateValid ? money(shipping) : "Calculated at checkout"}</Text>
        <View style={styles.summaryTotal}><Text style={styles.summaryTotalLabel}>Estimated total</Text><Text style={styles.summaryTotalPrice}>{money(estimatedTotal)}</Text></View>
      </View>
      {!!message && <Notice tone={/could not|unable|valid|select|enter|complete|expired|failed/i.test(message) ? "error" : "info"}>{message}</Notice>}
      <Button title={paymentMethod === "cod" ? "Place COD order & pay advance" : "Continue to Fonepay"} onPress={createOrder} loading={busy} disabled={!cartItems.length || branchBusy || !form.destination_branch || !rateValid || rateBusy} />
      <Text style={styles.disclaimer}>Order pricing, stock checks, coupons, COD advance and payment verification are rechecked by the Suru Collection server.</Text>
    </>}
  </Page>;
}

const styles = {
  back: { color: colors.primary, fontWeight: "700", marginBottom: 18 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 15 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "800", marginTop: 8, marginBottom: 10 },
  addressCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, marginBottom: 10, backgroundColor: colors.surface },
  addressCardActive: { borderColor: colors.primary, borderWidth: 2 },
  selectedAddressCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, marginBottom: 14, backgroundColor: colors.surface },
  addressCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  addressLabel: { color: colors.primary, fontSize: 13, fontWeight: "900", flex: 1 },
  defaultLabel: { color: colors.success, fontSize: 9, fontWeight: "900" },
  addressName: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: 3 },
  addressText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  radio: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: colors.muted },
  radioActive: { borderColor: colors.primary, borderWidth: 5 },
  editAddress: { alignSelf: "flex-start", marginTop: 9 },
  editAddressText: { color: colors.accent, fontWeight: "800", fontSize: 11 },
  saveAddressRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 10 },
  saveAddressText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: colors.primary, borderRadius: 4 },
  checkboxActive: { backgroundColor: colors.primary },
  eyebrow: { color: colors.accent, fontSize: 9, letterSpacing: 1.8, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 27, fontWeight: "800", marginTop: 5, marginBottom: 8 },
  pickerLabel: { color: colors.ink, fontSize: 12, fontWeight: "700", marginBottom: 5 },
  pickerBox: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: 12, overflow: "hidden" },
  branchMatchMessage: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: -5, marginBottom: 12 },
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